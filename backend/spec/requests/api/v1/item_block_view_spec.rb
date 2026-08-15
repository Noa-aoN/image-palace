require "rails_helper"

# カード詳細の項目の並び。**このカード1枚だけに効く**（種別の設定とは範囲が違う）。
RSpec.describe "カード詳細の項目の並び", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "word") { |t| t.label = "単語" } }
  let(:item) { user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed") }

  def block_view
    get "/api/v1/items/#{item.id}", headers: headers
    json_response["block_view"]
  end

  it "並べ替えた順が残る" do
    patch "/api/v1/items/#{item.id}/block_view",
      params: { order: %w[meaning image title], hidden: [], omitted: [] },
      headers: headers, as: :json

    expect(response).to have_http_status(:ok)
    expect(block_view["order"]).to eq(%w[meaning image title])
  end

  it "並べ替えを繰り返しても、最後の順が残る" do
    patch "/api/v1/items/#{item.id}/block_view",
      params: { order: %w[a b c], hidden: [], omitted: [] }, headers: headers, as: :json
    patch "/api/v1/items/#{item.id}/block_view",
      params: { order: %w[c a b], hidden: [], omitted: [] }, headers: headers, as: :json

    expect(block_view["order"]).to eq(%w[c a b])
  end

  it "並べ替えると、ひな型由来ではなくなる（from_preset が下りる）" do
    user.create_setting!(default_card_preset: "既定", card_property_presets: [
      { "name" => "既定", "keys" => %w[title image] }
    ])

    expect(block_view["from_preset"]).to be(true)

    patch "/api/v1/items/#{item.id}/block_view",
      params: { order: %w[image title], hidden: [], omitted: [] }, headers: headers, as: :json

    view = block_view
    expect(view["from_preset"]).to be(false)
    expect(view["order"]).to eq(%w[image title])
  end

  # 幅は並び替えとは別の話。並べ替えただけで幅が消えると、
  # 「動かしたら見た目が変わった」という分かりにくい壊れ方をする
  it "並べ替えても、札の幅は消えない" do
    patch "/api/v1/items/#{item.id}/block_view",
      params: { order: %w[title image], hidden: [], omitted: [], spans: { "title" => 2 } },
      headers: headers, as: :json
    expect(block_view["spans"]).to eq({ "title" => 2 })

    # 画面の並べ替えは spans を送らない
    patch "/api/v1/items/#{item.id}/block_view",
      params: { order: %w[image title], hidden: [], omitted: [] },
      headers: headers, as: :json

    expect(block_view["order"]).to eq(%w[image title])
    expect(block_view["spans"]).to eq({ "title" => 2 })
  end

  it "他人のカードは並べ替えられない" do
    other = create(:user, :confirmed)

    patch "/api/v1/items/#{item.id}/block_view",
      params: { order: %w[image title], hidden: [], omitted: [] },
      headers: auth_headers_for(other), as: :json

    expect(response).to have_http_status(:not_found)
  end

  # 列への振り分けは、**既定でも値が入る**（自動 = true）。
  # 「このカードは自分で並べたか」の判断に混ぜると、
  # どのカードも「並べた」と見なされ、ひな型が当たらなくなる
  it "振り分けの既定値だけでは、ひな型由来のままでいる" do
    user.create_setting!(default_card_preset: "既定", card_property_presets: [
      { "name" => "既定", "keys" => %w[title image] }
    ])

    view = block_view
    expect(view["auto_flow"]).to be(true)
    expect(view["column_counts"]).to eq([])
    expect(view["from_preset"]).to be(true)
  end
end
