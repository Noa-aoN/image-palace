require "rails_helper"

# 何を書いた文か。
#
# 「意味」と一括りにすると、**短く覚えたい人にも長い解説が出る**。
# 逆に、もとの意味だけ知りたいのに いまの意味しか無い、も起きる。
# 詳しさ（ひとこと / シンプル / くわしく）とは別の軸なので、混ぜない。
RSpec.describe "意味・説明の種類" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }

  def meaning(attrs = {})
    item.meanings.build({ definition: "植物が光で栄養を作る仕組み" }.merge(attrs))
  end

  it "既定は「意味」" do
    expect(meaning.tap(&:save!).kind).to eq("meaning")
  end

  it "説明・解説・翻訳・原義を持てる" do
    %w[description commentary translation origin].each do |kind|
      expect(meaning(kind: kind)).to be_valid
    end
  end

  it "知らない種類は入らない" do
    expect(meaning(kind: "なんでも")).not_to be_valid
  end

  it "画面から来た知らない値は既定へ倒す" do
    expect(Meaning.normalize_kind("commentary")).to eq("commentary")
    expect(Meaning.normalize_kind("なんでも")).to eq("meaning")
    expect(Meaning.normalize_kind(nil)).to eq("meaning")
  end

  it "種類で絞れる" do
    meaning(kind: "meaning").save!
    meaning(definition: "詳しい背景", kind: "commentary").save!

    expect(item.meanings.of_kind("commentary").pluck(:definition)).to eq([ "詳しい背景" ])
  end

  it "詳しさとは別に持つ（解説をひとことで書くこともある）" do
    row = meaning(kind: "commentary", detail_level: "brief")
    row.save!

    expect(row.kind).to eq("commentary")
    expect(row.detail_level).to eq("brief")
  end
end
