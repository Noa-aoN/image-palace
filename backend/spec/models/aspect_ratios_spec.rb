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

  it "黄金比は縦長で生成してから切り出す" do
    expect(described_class.provider_size("golden")).to eq("1024x1536")
    expect(described_class.crop_ratio("golden")).to be_within(0.001).of(1 / 1.618)
  end

  it "未知のキーは既定にフォールバックする" do
    expect(described_class.provider_size("bogus")).to eq("1024x1024")
    expect(described_class.valid?("bogus")).to be(false)
  end
end
