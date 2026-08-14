require "rails_helper"

# 作り直し。
#
# **作り直しが多い語は、指示が効いていない語。** 1枚ぶんの原価が丸ごと余分にかかる。
# どの語で何度も作り直しているかが分かれば、指示の作り方を直せる。
RSpec.describe "作り直しの数字" do
  let(:now) { Time.zone.local(2026, 8, 14, 12) }
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def item_with_images(title, count)
    item = create(:item, user: user, item_type: item_type, title: title)
    count.times do |i|
      shared = SharedMedia.create!(normalized_prompt: "#{title}-#{i}", metadata: { "model" => "gpt-image-1" })
      ItemMediaGeneration.record!(item: item, shared_media: shared, now: now - i.hours)
    end
    item
  end

  def metrics
    travel_to(now) { Admin::BusinessMetricsService.call(now: now, period: "30d") }[:regeneration]
  end

  it "記録のあるカードと、作り直したカードを数える" do
    item_with_images("光合成", 3)
    item_with_images("重力", 1)

    result = metrics

    expect(result[:tracked_items]).to eq(2)
    expect(result[:redone_items]).to eq(1)
  end

  it "余分に作った枚数を数える（そのぶん原価が出ている）" do
    item_with_images("光合成", 3) # 2枚ぶん余分
    item_with_images("重力", 2)   # 1枚ぶん余分

    expect(metrics[:extra_images]).to eq(3)
  end

  it "1枚しか作っていなければ、余分は0" do
    item_with_images("重力", 1)

    expect(metrics[:extra_images]).to eq(0)
    expect(metrics[:redone_items]).to eq(0)
  end

  it "いちばん作り直している語を出す（指示を直す手がかり）" do
    item_with_images("光合成", 4)
    item_with_images("重力", 2)
    item_with_images("慣性", 1)

    top = metrics[:top_items]

    expect(top.first).to eq({ title: "光合成", images: 4 })
    expect(top.map { |row| row[:title] }).not_to include("慣性")
  end

  it "記録がなければ、割合を 0% と書かない" do
    result = metrics

    expect(result[:tracked_items]).to eq(0)
    expect(result[:share_of_tracked]).to be_nil
  end

  it "余分な原価は、1枚あたりの実原価が出せるときだけ出す" do
    item_with_images("光合成", 2)

    # 使われたクレジットが無いので 1枚あたりの原価が出せない
    expect(metrics[:extra_cost_jpy]).to be_nil
  end
end
