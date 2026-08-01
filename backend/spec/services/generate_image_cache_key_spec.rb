require "rails_helper"

RSpec.describe GenerateImageService, ".namespaced_cache_key" do
  # 縦横比が違えば別の画像。分けないと、正方形の既存画像が縦長カードに再利用される
  it "縦横比ごとにキーを分ける" do
    square = described_class.namespaced_cache_key("cat", aspect_ratio: "square")
    portrait = described_class.namespaced_cache_key("cat", aspect_ratio: "portrait")
    golden = described_class.namespaced_cache_key("cat", aspect_ratio: "golden")

    expect([ square, portrait, golden ].uniq.size).to eq(3)
  end

  # 既存キャッシュを捨てないため、既定（正方形）は素のキーのまま
  it "正方形は既存キャッシュと同じキーを使う" do
    expect(described_class.namespaced_cache_key("cat", aspect_ratio: "square")).to eq("cat")
    expect(described_class.namespaced_cache_key("cat")).to eq("cat")
  end

  it "同じ縦横比・同じプロンプトなら同じキーになる（キャッシュが効く）" do
    a = described_class.namespaced_cache_key("cat", aspect_ratio: "portrait")
    b = described_class.namespaced_cache_key("cat", aspect_ratio: "portrait")
    expect(a).to eq(b)
  end
end
