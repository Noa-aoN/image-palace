require "rails_helper"

RSpec.describe Admin::FinanceService do
  let(:user) { create(:user, :confirmed) }
  let(:now) { Time.zone.local(2026, 8, 15, 12, 0, 0) }

  def summary
    described_class.call(year: 2026, month: 8)
  end

  before do
    travel_to(now)
    # インフラの既定は概算が入っているので、ここでは切って他の項目だけを見る
    %w[infra_usd.fly infra_usd.neon infra_usd.workers infra_usd.r2 infra_usd.sentry infra_jpy.domain].each do |key|
      CostParameter.create!(key: key, value: 0)
    end
  end

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

  # image_usages を入れる前の生成は記録が無い。shared_medias から拾えないと
  # 8月の画像原価が「1枚 6円」のように実態とかけ離れる（本番で実際にそうなった）
  describe "記録を入れる前の画像" do
    before do
      CostParameter.create!(key: "fx_usd_jpy", value: 150)
      CostParameter.create!(key: "image_usd.gpt-image-1.medium", value: 0.04)
    end

    def shared(count)
      count.times do |n|
        SharedMedia.create!(normalized_prompt: "w#{n}", metadata: { "model" => "gpt-image-1", "quality" => "medium" })
      end
    end

    it "共有画像から枚数を拾う" do
      shared(10)

      image = summary[:cost][:image]
      expect(image[:count]).to eq(10)
      expect(image[:jpy]).to eq(60)
    end

    # 移行期は両方に行があるので、多い方を採って二重計上を避ける
    it "記録と共有画像の両方があっても二重に数えない" do
      shared(10)
      4.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium") }

      expect(summary[:cost][:image][:count]).to eq(10)
    end

    it "記録の方が多ければ記録を採る" do
      shared(2)
      5.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium") }

      expect(summary[:cost][:image][:count]).to eq(5)
    end

    # カード以外（アバター等）は共有画像を通らないので、記録のぶんがそのまま乗る
    it "カード以外の生成は別で数える" do
      shared(3)
      2.times { ImageUsage.record!(kind: "avatar", provider: "openai", model: "gpt-image-1", quality: "medium") }

      expect(summary[:cost][:image][:count]).to eq(5)
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

  # 海外ベンダーはドル建て。為替を掛けないと円安のときに黙って過少になる
  describe "インフラ" do
    it "ドル建ての月額に為替を掛けて足す" do
      CostParameter.find_by(key: "infra_usd.fly").update!(value: 10)
      CostParameter.find_by(key: "infra_jpy.domain").update!(value: 130)
      CostParameter.create!(key: "fx_usd_jpy", value: 150)

      expect(summary[:cost][:infra]).to eq(1_630) # 10 * 150 + 130
    end
  end

  it "データが無くても壊れない" do
    expect(summary[:profit]).to be_a(Integer)
    expect(summary[:margin]).to be_nil
  end
end
