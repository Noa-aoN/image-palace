require "rails_helper"

# 中身が2つある項目（自由テキスト・自由イメージ）を、一覧に出したときの見え方。
#
# これらの値は見出しと中身の2つを持つ。**そのまま文字にすると
# `{"heading"=>"葉", "body"=>"…"}` が一覧に並ぶ。**
RSpec.describe "一覧に出す、中身が2つある項目", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, :completed, user: user, item_type: item_type, title: "光合成") }

  def define!(key, value_type)
    user.property_definitions.create!(item_type: item_type, key: key, label: key, value_type: value_type)
  end

  def write!(definition, value)
    property = item.item_properties.create!(property_definition: definition)
    property.typed_value = value
    property.save!
  end

  # 一覧に出す項目は設定で決まる。見えていなければ、そもそも文字にならない。
  #
  # **並びの先頭の項目は名前になり、下には出ない**ので、名前を受け止める項目を
  # 先に1つ置いてから、見たい項目を並べる
  def show_in_list!(*keys)
    write!(define!("reading", "text"), "こうごうせい")
    layout = ([ "reading" ] + keys).map { |key| { "key" => key, "visible" => true } }
    (user.setting || user.create_setting!).update!(card_list_layout: layout)
  end

  # 名前として出す項目は、並びの先頭が決める
  def headline_from!(key)
    (user.setting || user.create_setting!)
      .update!(card_list_layout: [ { "key" => key, "visible" => true } ])
  end

  def list_fields
    get "/api/v1/items", headers: headers
    response.parsed_body["items"].first["list_fields"].to_h { |row| [ row["key"], row["value"] ] }
  end

  it "自由テキストは、見出しと本文をつないで出す" do
    write!(define!("note", "free_text"), { "heading" => "覚え方", "body" => "葉が光を食べる" })
    show_in_list!("note")

    expect(list_fields["note"]).to eq("覚え方：葉が光を食べる")
  end

  it "見出しが無ければ、本文だけを出す" do
    write!(define!("note", "free_text"), { "heading" => "", "body" => "葉が光を食べる" })
    show_in_list!("note")

    expect(list_fields["note"]).to eq("葉が光を食べる")
  end

  it "本文が無ければ、見出しだけを出す（区切りだけが残らない）" do
    write!(define!("note", "free_text"), { "heading" => "覚え方", "body" => "" })
    show_in_list!("note")

    expect(list_fields["note"]).to eq("覚え方")
  end

  # 絵は文字にできない。**何の絵かが分かる名前**で表す
  it "自由イメージは、付けた見出しで表す" do
    write!(define!("scene", "free_image"), { "heading" => "葉のなか", "prompt" => "葉緑体が光を受けている" })
    show_in_list!("scene")

    expect(list_fields["scene"]).to eq("葉のなか")
  end

  it "見出しを付けていない自由イメージは、何を描かせたかで表す" do
    write!(define!("scene", "free_image"), { "heading" => "", "prompt" => "葉緑体が光を受けている" })
    show_in_list!("scene")

    expect(list_fields["scene"]).to eq("葉緑体が光を受けている")
  end

  it "中身が2つある項目を名前に使っても、記号の並びにならない" do
    write!(define!("note", "free_text"), { "heading" => "覚え方", "body" => "葉が光を食べる" })
    headline_from!("note")

    get "/api/v1/items", headers: headers

    expect(response.parsed_body["items"].first["headline"]).to eq("覚え方：葉が光を食べる")
  end
end
