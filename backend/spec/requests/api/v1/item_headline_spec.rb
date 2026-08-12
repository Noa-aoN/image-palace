require "rails_helper"

# カード一覧で名前として出す項目を選べるようにしたぶん。
# 別名や読み方で覚えている人が、その表記のまま棚を眺められるようにするための機能。
RSpec.describe "一覧の見出し語", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { create(:item_type) }
  let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }

  def define_property(key:, label:, value_type: "text")
    user.property_definitions.create!(item_type: item_type, key: key, label: label, value_type: value_type)
  end

  def set_value(definition, value)
    item.item_properties.create!(property_definition: definition, value: { "v" => value })
  end

  it "設定していなければ見出し語をそのまま返す" do
    get "/api/v1/items/#{item.id}", headers: headers

    expect(response.parsed_body["headline"]).to eq("光合成")
  end

  it "設定した項目の値を返す" do
    definition = define_property(key: "reading", label: "読み方")
    set_value(definition, "こうごうせい")
    user.create_setting!(card_headline_key: "reading")

    get "/api/v1/items/#{item.id}", headers: headers

    expect(response.parsed_body["headline"]).to eq("こうごうせい")
  end

  # #589 / #590 で変えた。**選んだのに何も変わらない**方が分かりにくい。
  # 値が無いことは、値が無いと分かる形（画面の「-」）で見せる
  it "その項目が空でも、見出し語へ勝手に戻さない" do
    define_property(key: "reading", label: "読み方")
    user.create_setting!(card_headline_key: "reading")

    get "/api/v1/items/#{item.id}", headers: headers

    expect(response.parsed_body["headline"]).to be_nil
  end

  it "複数入る項目は先頭を使う" do
    definition = define_property(key: "aliases", label: "別名", value_type: "list")
    set_value(definition, [ "炭酸同化", "光合成作用" ])
    user.create_setting!(card_headline_key: "aliases")

    get "/api/v1/items/#{item.id}", headers: headers

    expect(response.parsed_body["headline"]).to eq("炭酸同化")
  end

  it "一覧にも同じ名前が出る" do
    definition = define_property(key: "reading", label: "読み方")
    set_value(definition, "こうごうせい")
    user.create_setting!(card_headline_key: "reading")

    get "/api/v1/items", headers: headers

    expect(response.parsed_body["items"].first["headline"]).to eq("こうごうせい")
    # 見出し語そのものは残す（詳細や検索が使う）
    expect(response.parsed_body["items"].first["title"]).to eq("光合成")
  end

  # 1枚ごとに項目定義を引くと、枚数ぶん問い合わせが飛ぶ。
  # 全体の本数を数えると他の変更に巻き込まれて壊れやすいので、
  # 「項目定義を何回読んだか」だけを見る。
  #
  # 1回すら引かないこともある。どのカードも値を持たなければ、
  # 引く相手が無いので eager load ごと省かれる。見たいのは上限なので、それでよい
  it "項目定義は枚数によらず高々1回しか読まない" do
    define_property(key: "reading", label: "読み方")
    user.create_setting!(card_headline_key: "reading")
    5.times { |i| create(:item, user: user, item_type: item_type, title: "語#{i}") }

    reads = 0
    counter = lambda do |*, payload|
      reads += 1 if payload[:sql].to_s.include?("property_definitions") && payload[:name] != "CACHE"
    end
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
      get "/api/v1/items", headers: headers
    end

    expect(reads).to be <= 1
  end

  # 名前と絵のほかに出す項目。増やすほど1枚が縦に伸びるので上限を持つ
  describe "一覧に出す追加項目" do
    it "設定した項目の値を返す" do
      definition = define_property(key: "reading", label: "読み方")
      set_value(definition, "こうごうせい")
      user.create_setting!(card_list_fields: [ "reading" ])

      get "/api/v1/items", headers: headers

      expect(response.parsed_body["items"].first["list_fields"]).to eq(
        [ { "key" => "reading", "label" => "読み方", "value" => "こうごうせい" } ]
      )
    end

    # #589 / #590 で変えた。出す指定なら、値が無くても行は返す。
    # 返さないと、出るカードと出ないカードが混ざり、法則が読めない
    it "値の無い項目も、行としては返す（画面が「-」を出せるように）" do
      item # 一覧に出すカードを作っておく（let は参照するまで作られない）
      define_property(key: "reading", label: "読み方")
      user.create_setting!(card_list_fields: [ "reading" ])

      get "/api/v1/items", headers: headers

      expect(response.parsed_body["items"].first["list_fields"]).to eq(
        [ { "key" => "reading", "label" => "読み方", "value" => nil } ]
      )
    end

    it "複数入る項目はつないで返す" do
      definition = define_property(key: "aliases", label: "別名", value_type: "list")
      set_value(definition, [ "炭酸同化", "光合成作用" ])
      user.create_setting!(card_list_fields: [ "aliases" ])

      get "/api/v1/items", headers: headers

      expect(response.parsed_body["items"].first["list_fields"].first["value"]).to eq("炭酸同化、光合成作用")
    end

    it "上限を超えたぶんは保存時に切る" do
      setting = user.create_setting!
      setting.update!(card_list_fields: %w[a b c d e])

      expect(setting.reload.card_list_fields.size).to eq(Setting::MAX_CARD_LIST_FIELDS)
    end

    it "設定していなければ空で返す" do
      item

      get "/api/v1/items", headers: headers

      expect(response.parsed_body["items"].first["list_fields"]).to eq([])
    end
  end
end
