require "rails_helper"

# ページをまたいだときに、同じカードが二度出たり、どこにも出なかったりしないこと。
#
# 並びの鍵が同着だと、LIMIT/OFFSET はページごとに違う順を返し得る。
# 「重複して見える」の正体がこれだと、データを見ても何も起きていないので気づきにくい。
RSpec.describe "一覧のページング", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  # 作成時刻が完全に同じカードを並べる（一括作成で起こり得る）
  def create_items(count, title: nil, at: Time.zone.local(2026, 8, 13, 9, 0, 0))
    count.times.map do |i|
      item = user.items.create!(title: title || "語#{i}", item_type: item_type)
      item.update_columns(created_at: at, updated_at: at)
      item
    end
  end

  def page_ids(page, per: 4, sort: "created_at", direction: "desc")
    get "/api/v1/items", params: { page: page, per: per, sort: sort, direction: direction }, headers: headers
    json_response["items"].map { |item| item["id"] }
  end

  it "作成時刻が同じでも、全ページを合わせると過不足が無い" do
    created = create_items(10)

    collected = (1..3).flat_map { |page| page_ids(page) }

    expect(collected.uniq.size).to eq(10)
    expect(collected.size).to eq(10)
    expect(collected.to_set).to eq(created.map(&:id).to_set)
  end

  it "名前も作成時刻も同じでも、順が毎回変わらない" do
    create_items(8, title: "同じ名前")

    first = (1..2).flat_map { |page| page_ids(page, sort: "title", direction: "asc") }
    second = (1..2).flat_map { |page| page_ids(page, sort: "title", direction: "asc") }

    expect(second).to eq(first)
    expect(first.uniq.size).to eq(8)
  end

  it "同じ名前の別カードは、まとめずに2件とも出る" do
    create_items(2, title: "アリストパネス")

    ids = page_ids(1, per: 24)

    expect(ids.size).to eq(2)
    get "/api/v1/items", headers: headers
    expect(json_response["items"].map { |item| item["title"] }).to eq(%w[アリストパネス アリストパネス])
  end

  it "1ページの枚数を変えると、総ページ数がそれに従う" do
    create_items(10)

    get "/api/v1/items", params: { per: 5 }, headers: headers
    expect(json_response["meta"]["total_pages"]).to eq(2)

    get "/api/v1/items", params: { per: 3 }, headers: headers
    expect(json_response["meta"]["total_pages"]).to eq(4)
    expect(json_response["meta"]["total_count"]).to eq(10)
  end
end
