require "rails_helper"

RSpec.describe Admin::FinanceService do
  let(:user) { create(:user, :confirmed) }
  let(:now) { Time.zone.local(2026, 8, 15, 12, 0, 0) }

  def summary
    described_class.call(year: 2026, month: 8)
  end

  before { travel_to(now) }

  describe "収入" do
    it "その月の決済額を合計する" do
      CreditTransaction.create!(user: user, kind: "topup_purchase", delta: 1000, amount_cents: 1_900)
      CreditTransaction.create!(user: user, kind: "subscription_grant", delta: 10_000, amount_cents: 1_480)
      # 前月分は含めない
      travel_to(now - 1.month) do
        CreditTransaction.create!(user: user, kind: "topup_purchase", delta: 1000, amount_cents: 9_999)
      end

      expect(summary[:revenue][:total]).to eq(3_380)
    end

    it "金額の無い明細（付与・消費）は数えない" do
      CreditTransaction.create!(user: user, kind: "consumption", delta: -100)

      expect(summary[:revenue][:total]).to eq(0)
    end
  end

  describe "画像の原価" do
    it "枚数 × 単価 × 為替で概算する" do
      CostParameter.create!(key: "fx_usd_jpy", value: 150)
      CostParameter.create!(key: "image_usd.gpt-image-1.medium", value: 0.04)
      3.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium") }

      image = summary[:cost][:image]
      expect(image[:count]).to eq(3)
      expect(image[:jpy]).to eq(18) # 0.04 * 3 * 150
    end

    # 品質別の単価が無ければモデルの単価に落ちる
    it "品質別の単価が未設定ならモデルの単価を使う" do
      CostParameter.create!(key: "fx_usd_jpy", value: 100)
      CostParameter.create!(key: "image_usd.flux-pro", value: 0.05)
      ImageUsage.record!(kind: "item", provider: "fal", model: "flux-pro", quality: "ultra")

      expect(summary[:cost][:image][:jpy]).to eq(5)
    end
  end

  describe "文章の原価" do
    it "入力と出力のトークンを別の単価で計算する" do
      CostParameter.create!(key: "fx_usd_jpy", value: 100)
      CostParameter.create!(key: "text_in_usd.gpt-4o-mini", value: 1.0)
      CostParameter.create!(key: "text_out_usd.gpt-4o-mini", value: 10.0)
      AiUsage.create!(user: user, kind: "brief", model: "gpt-4o-mini",
                      prompt_tokens: 1_000_000, completion_tokens: 1_000_000, cost_points: 0,
                      created_at: Time.current)

      # (1.0 + 10.0) USD * 100
      expect(summary[:cost][:text][:jpy]).to eq(1_100)
    end
  end

  describe "決済手数料" do
    it "売上に手数料率を掛ける" do
      CostParameter.create!(key: "stripe_fee_rate", value: 0.036)
      CreditTransaction.create!(user: user, kind: "topup_purchase", delta: 1000, amount_cents: 10_000)

      expect(summary[:cost][:stripe_fee]).to eq(360)
    end
  end

  describe "請求実額との比較" do
    it "未入力なら recorded は false" do
      expect(summary[:actual][:recorded]).to be(false)
    end

    # 概算の確度はここでしか上がらない
    it "入力されていれば乖離を出す" do
      CostParameter.create!(key: "fx_usd_jpy", value: 150)
      CostParameter.create!(key: "image_usd.gpt-image-1.medium", value: 0.04)
      10.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium") }
      MonthlyActual.create!(year: 2026, month: 8, openai_jpy: 72, infra_jpy: 0, other_jpy: 0)

      actual = summary[:actual]
      expect(actual[:recorded]).to be(true)
      expect(actual[:estimated]).to eq(60) # 0.04 * 10 * 150
      expect(actual[:actual]).to eq(72)
      expect(actual[:diff]).to eq(12)
      expect(actual[:diff_rate]).to eq(20.0)
    end
  end

  it "データが無くても壊れない" do
    expect(summary[:profit]).to be_a(Integer)
    expect(summary[:margin]).to be_nil
  end
end
