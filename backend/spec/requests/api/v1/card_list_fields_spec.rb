require "rails_helper"

# 一覧のカードに何を出すか。
#
# **設定したのに何も変わらない、が最も分かりにくい。**
# 値が無いときに黙って見出し語へ戻すと、効いているのに効いていないように見える。
# 出す指定なら、値が無くても「無い」と分かる形で返す。
RSpec.describe "一覧に出す項目", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "word") { |t| t.label = "単語" } }
  let(:setting) { user.setting || Setting.create!(user: user) }

  # 「読み方」の項目を作り、片方のカードにだけ値を入れる
  def define_property!(key, label)
    PropertyDefinition.create!(user: user, item_type: item_type, key: key, label: label,
                               value_type: "text", position: 1)
  end

  def create_item!(title:, property: nil, definition: nil)
    item = user.items.create!(title: title, item_type: item_type, generation_status: "completed")
    if property && definition
      item.item_properties.create!(property_definition: definition, typed_value: property)
    end
    item
  end

  def listed(title)
    get "/api/v1/items", headers: headers
    json_response["items"].find { |row| row["title"] == title }
  end

  describe "名前に出す項目" do
    let!(:definition) { define_property!("reading", "読み方") }

    # 並びの先頭に置いた項目が、名前になる
    before do
      setting.update!(card_list_layout: [ { "key" => "reading", "visible" => true },
                                          { "key" => "image", "visible" => true } ])
    end

    it "値があれば、その値を名前として返す" do
      create_item!(title: "薔薇", property: "ばら", definition: definition)

      expect(listed("薔薇")["headline"]).to eq("ばら")
    end

    # ここが #589 / #590 の主因。戻すと「効いていない」に見える
    it "値が無くても、見出し語へ勝手に戻さない" do
      create_item!(title: "菫")

      expect(listed("菫")["headline"]).to be_nil
    end

    it "選んでいなければ、これまでどおり見出し語を返す" do
      setting.update!(card_list_layout: Setting::DEFAULT_CARD_LIST_LAYOUT)
      create_item!(title: "百合")

      expect(listed("百合")["headline"]).to eq("百合")
    end
  end

  describe "名前の下に出す項目" do
    let!(:definition) { define_property!("reading", "読み方") }

    before do
      setting.update!(card_list_layout: [
        { "key" => "title", "visible" => true },
        { "key" => "image", "visible" => true },
        { "key" => "reading", "visible" => true }
      ])
    end

    it "値があれば、その値を返す" do
      create_item!(title: "薔薇", property: "ばら", definition: definition)

      field = listed("薔薇")["list_fields"].find { |f| f["key"] == "reading" }
      expect(field["value"]).to eq("ばら")
      expect(field["label"]).to eq("読み方")
    end

    # 出す指定なら、値が無くても行を返す。返さないと、
    # 出るカードと出ないカードが混ざり、法則が読めなくなる
    it "値が無くても行は返す（画面が「-」を出せるように）" do
      create_item!(title: "菫")

      field = listed("菫")["list_fields"].find { |f| f["key"] == "reading" }
      expect(field).to be_present
      expect(field["value"]).to be_nil
    end

    it "出さない指定の項目は、そもそも返さない" do
      setting.update!(card_list_layout: [
        { "key" => "title", "visible" => true },
        { "key" => "reading", "visible" => false }
      ])
      create_item!(title: "薔薇", property: "ばら", definition: definition)

      expect(listed("薔薇")["list_fields"].map { |f| f["key"] }).not_to include("reading")
    end

    it "名前と絵は、カードの形そのものなので項目としては返さない" do
      create_item!(title: "薔薇")

      keys = listed("薔薇")["list_fields"].map { |f| f["key"] }
      expect(keys).not_to include("title", "image")
    end

    it "意味・説明は先頭の1件を返す" do
      setting.update!(card_list_layout: [ { "key" => "meaning", "visible" => true } ])
      item = create_item!(title: "薔薇")
      item.meanings.create!(definition: "とげのある花", position: 1)
      item.meanings.create!(definition: "二番目の意味", position: 2)

      field = listed("薔薇")["list_fields"].find { |f| f["key"] == "meaning" }
      expect(field["value"]).to eq("とげのある花")
    end
  end

  # 一覧は件数ぶん回る。項目を足したぶんだけ問い合わせが増えると、すぐ効いてくる
  it "カードが増えても問い合わせの本数が増えない" do
    definition = define_property!("reading", "読み方")
    setting.update!(card_list_layout: [ { "key" => "reading", "visible" => true } ])
    3.times { |i| create_item!(title: "語#{i}", property: "よみ#{i}", definition: definition) }

    get "/api/v1/items", headers: headers # 温める

    count = 0
    sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      next if payload[:name].to_s.match?(/SCHEMA|TRANSACTION/)

      count += 1
    end
    get "/api/v1/items", headers: headers
    ActiveSupport::Notifications.unsubscribe(sub)
    few = count

    5.times { |i| create_item!(title: "追加#{i}", property: "よみ#{i}", definition: definition) }

    count = 0
    sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      next if payload[:name].to_s.match?(/SCHEMA|TRANSACTION/)

      count += 1
    end
    get "/api/v1/items", headers: headers
    ActiveSupport::Notifications.unsubscribe(sub)

    expect(count).to eq(few)
  end
end
