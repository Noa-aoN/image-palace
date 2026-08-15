require "rails_helper"

# どの Stripe の鍵を使うか。
#
# **事故の形は決まっている。** 本番確認のために手元へ Live の鍵を入れ、戻し忘れて、
# ローカルの操作で実際の請求が起きる。鍵は見た目がほぼ同じで、気づけない。
RSpec.describe Billing::KeySelection do
  def select(env, local:)
    described_class.select(env: env, local: local)
  end

  # 本番はこの形で動いている。**ここを壊さないことが第一**
  describe "従来どおりの指定（モードを書かない）" do
    it "本番で Live の鍵をそのまま使う" do
      result = select({ "STRIPE_SECRET_KEY" => "sk_live_x", "STRIPE_WEBHOOK_SECRET" => "whsec_a" },
                      local: false)

      expect(result.api_key).to eq("sk_live_x")
      expect(result.webhook_secret).to eq("whsec_a")
      expect(result.mode).to eq("live")
      expect(result).not_to be_refused
    end

    it "手元で Test の鍵はそのまま使う" do
      result = select({ "STRIPE_SECRET_KEY" => "sk_test_x", "STRIPE_WEBHOOK_SECRET" => "whsec_a" },
                      local: true)

      expect(result.api_key).to eq("sk_test_x")
      expect(result.mode).to eq("test")
    end

    it "何も指定が無ければ、鍵なしとして扱う（起動は妨げない）" do
      result = select({}, local: true)

      expect(result.api_key).to be_nil
      expect(result.mode).to eq("none")
      expect(result).not_to be_refused
    end
  end

  describe "手元に Live の鍵が入っていたら" do
    let(:env) { { "STRIPE_SECRET_KEY" => "sk_live_x", "STRIPE_WEBHOOK_SECRET" => "whsec_a" } }

    it "使わない（鍵を渡さないので、課金そのものが起きない）" do
      result = select(env, local: true)

      expect(result).to be_refused
      expect(result.api_key).to be_nil
      expect(result.webhook_secret).to be_nil
    end

    it "理由を残す。**値は含めない**" do
      result = select(env, local: true)

      expect(result.refusal).to include("Live")
      expect(result.refusal).not_to include("sk_live_x")
    end

    it "制限付きの鍵（rk_live_）も同じ扱い" do
      result = select({ "STRIPE_SECRET_KEY" => "rk_live_x" }, local: true)

      expect(result).to be_refused
    end

    it "はっきり許したときだけ使う" do
      result = select(env.merge("ALLOW_LIVE_STRIPE_LOCALLY" => "true"), local: true)

      expect(result).not_to be_refused
      expect(result.api_key).to eq("sk_live_x")
    end

    it "true 以外の書き方では許さない（うっかり通さない）" do
      for value in %w[1 yes TRUE on] do
        expect(select(env.merge("ALLOW_LIVE_STRIPE_LOCALLY" => value), local: true)).to be_refused
      end
    end
  end

  describe "モードを明示したとき" do
    let(:env) do
      {
        "STRIPE_MODE" => "test",
        "STRIPE_TEST_SECRET_KEY" => "sk_test_scoped",
        "STRIPE_TEST_WEBHOOK_SECRET" => "whsec_test",
        "STRIPE_LIVE_SECRET_KEY" => "sk_live_scoped",
        "STRIPE_LIVE_WEBHOOK_SECRET" => "whsec_live",
        "STRIPE_SECRET_KEY" => "sk_test_fallback"
      }
    end

    it "そのモードの組を選ぶ" do
      result = select(env, local: true)

      expect(result.api_key).to eq("sk_test_scoped")
      expect(result.webhook_secret).to eq("whsec_test")
    end

    # 片方だけ別モードだと、決済は通るのに webhook が全部弾かれる
    it "鍵と署名シークレットは、必ず同じモードの組になる" do
      result = select(env.merge("STRIPE_MODE" => "live"), local: false)

      expect(result.api_key).to eq("sk_live_scoped")
      expect(result.webhook_secret).to eq("whsec_live")
    end

    it "モード別の指定が無ければ、従来の指定に落ちる" do
      result = select({ "STRIPE_MODE" => "test", "STRIPE_SECRET_KEY" => "sk_test_fallback" },
                      local: true)

      expect(result.api_key).to eq("sk_test_fallback")
    end

    it "live を選んでも、手元なら拒む（明示だけでは通さない）" do
      expect(select(env.merge("STRIPE_MODE" => "live"), local: true)).to be_refused
    end
  end
end
