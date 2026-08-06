require "rails_helper"

RSpec.describe AspectRatios do
  it "既定は正方形" do
    expect(described_class::DEFAULT).to eq("square")
    expect(described_class.provider_size("square")).to eq("1024x1024")
    expect(described_class.crop_ratio("square")).to be_nil
  end

  # 生成 API が出せる比はそのまま、出せない比だけ切り出す
  it "縦長は API のサイズをそのまま使い、切り出さない" do
    expect(described_class.provider_size("portrait")).to eq("1024x1536")
    expect(described_class.crop_ratio("portrait")).to be_nil
  end

  it "黄金比（縦）は縦長で生成してから切り出す" do
    expect(described_class.provider_size("golden")).to eq("1024x1536")
    expect(described_class.crop_ratio("golden")).to be_within(0.001).of(1 / 1.618)
  end

  it "黄金比（横）は横長で生成してから切り出す" do
    expect(described_class.provider_size("golden_landscape")).to eq("1536x1024")
    expect(described_class.crop_ratio("golden_landscape")).to be_within(0.001).of(1.618)
  end

  # 保存済みの画像は縦で焼かれている。キーの意味を横へ付け替えると、
  # 既存カードだけ枠と中身が食い違うので、golden は縦のまま据え置く
  it "golden は縦のまま（既存カードを壊さない）" do
    expect(described_class.fetch("golden")[:ratio]).to be < 1
    expect(described_class.fetch("golden_landscape")[:ratio]).to be > 1
  end

  it "未知のキーは既定にフォールバックする" do
    expect(described_class.provider_size("bogus")).to eq("1024x1024")
    expect(described_class.valid?("bogus")).to be(false)
  end
end
