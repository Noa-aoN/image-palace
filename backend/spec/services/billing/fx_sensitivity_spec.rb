require "rails_helper"

# 為替がどこまで動いても採算が持つか。
#
# 売る値段は円で、AI の原価はドルで決まる。**円安になるほど、
# 同じ値段のまま原価だけが上がる。** 気づくのが値上げの直前になると、
# 利用者には「急に上げた」ようにしか見えない。
RSpec.describe Billing::FxSensitivity do
  before do
    CostParameter.create!(key: "fx_usd_jpy", value: 150)
    CostParameter.create!(key: "image_usd.gpt-image-1", value: 0.04)
  end

  it "いまのレートと、1クレジットあたりのドル建て原価を返す" do
    result = described_class.call

    expect(result.fx_rate).to eq(150.0)
    expect(result.usd_per_credit).to eq(0.04)
    expect(result.basis).to eq("configured")
  end

  it "実際に使われたぶんがあれば、そちらから割り出す（設定値より実態に近い）" do
    # 100クレジット使って 600円かかった → 1crあたり6円 → 150円/ドルなら 0.04 ドル
    result = described_class.call(consumed_credits: 100, ai_cost_jpy: 600)

    expect(result.usd_per_credit).to be_within(0.001).of(0.04)
    expect(result.basis).to eq("measured")
  end

  it "使われていなければ設定値に戻る" do
    result = described_class.call(consumed_credits: 0, ai_cost_jpy: 0)

    expect(result.basis).to eq("configured")
  end

  describe "余裕" do
    it "いちばん先に音を上げるものが分かる" do
      tightest = described_class.call.tightest

      expect(tightest[:name]).to be_present
      expect(tightest[:break_even_fx]).to be > 150
    end

    it "赤字になる手前に、見直しの線を置く" do
      tightest = described_class.call.tightest

      # 粗利の下限を割る方が先に来る（赤字より手前で気づける）
      expect(tightest[:margin_floor_fx]).to be < tightest[:break_even_fx]
    end

    it "いまのレートからの余地を割合で出す" do
      tightest = described_class.call.tightest

      expect(tightest[:headroom_percent]).to be_positive
    end

    it "原価が上がるほど、余地は縮む" do
      cheap = described_class.call(consumed_credits: 100, ai_cost_jpy: 300).tightest
      pricey = described_class.call(consumed_credits: 100, ai_cost_jpy: 900).tightest

      expect(pricey[:headroom_percent]).to be < cheap[:headroom_percent]
    end
  end

  it "無料プランは数えない（採算の対象外）" do
    names = described_class.call.plans.map { |plan| plan[:name] }

    expect(names).not_to include("free")
  end

  it "値段も付与量も変えない（数えるだけ）" do
    expect { described_class.call }.not_to change { Billing::Catalog::SUBSCRIPTIONS }
  end
end
