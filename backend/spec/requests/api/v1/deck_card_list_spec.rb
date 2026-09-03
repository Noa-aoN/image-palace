require "rails_helper"

# デッキを「一覧と同じ札」で見せるための返し方。
#
# 札の組み立ては利用者の設定から決まる。ItemsController の中に閉じていたので、
# デッキからは使えず、同じカードなのに一覧と違う見え方になっていた。
RSpec.describe "デッキの札", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:deck) { create(:view, user: user, view_type: "deck", name: "英単語") }

  def card(title)
    create(:item, user: user, item_type: item_type, title: title)
  end

  def place(item)
    deck.view_items.create!(item_id: item.id, position: deck.view_items.count + 1)
  end

  it "デッキのカードは一覧と同じ札の形で返る" do
    item = card("DNS")
    item.meanings.create!(definition: "名前を番地に変える仕組み", language_code: "ja")
    item.tags << Tag.create!(user: user, name: "ネットワーク")
    place(item)

    get "/api/v1/views/#{deck.id}", headers: headers

    row = json_response["items"].first["item"]
    # 一覧の札にしかないもの（見出し・項目・タグ・判定）が揃っていること
    expect(row).to include("headline", "list_fields", "tags", "fact_check_status")
    expect(row["headline"]).to eq("DNS")
    expect(row["tags"].first["name"]).to eq("ネットワーク")
  end

  it "並べ方の設定は、カードごとではなくキャンバスに1回だけ付く" do
    place(card("DNS"))

    get "/api/v1/views/#{deck.id}", headers: headers

    expect(json_response["card_list"]).to include("blocks", "image", "type_mark")
    expect(json_response["items"].first["item"]).not_to have_key("card_list")
  end

  it "デッキ以外は札を作らない（板や空間は絵と名前しか出さない）" do
    board = create(:view, user: user, view_type: "freeboard", name: "板")
    board.view_items.create!(item_id: card("DNS").id, x: 0, y: 0)

    get "/api/v1/views/#{board.id}", headers: headers

    expect(json_response["items"].first["item"]).not_to have_key("list_fields")
    expect(json_response).not_to have_key("card_list")
  end

  # ここが崩れると、枚数の多いデッキだけが静かに重くなる
  it "枚数を増やしても、項目の表を引く回数は変わらない" do
    3.times { |i| place(card("語#{i}")) }
    get "/api/v1/views/#{deck.id}", headers: headers
    few = count_property_queries { get "/api/v1/views/#{deck.id}", headers: headers }

    5.times { |i| place(card("追加#{i}")) }
    many = count_property_queries { get "/api/v1/views/#{deck.id}", headers: headers }

    expect(many).to eq(few)
  end

  def count_property_queries
    count = 0
    counter = lambda do |_n, _s, _f, _i, payload|
      count += 1 if payload[:sql].to_s.include?(%q("item_properties"))
    end
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { yield }
    count
  end
end
