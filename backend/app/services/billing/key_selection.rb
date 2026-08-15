# frozen_string_literal: true

module Billing
  # どの Stripe の鍵を使うかを、1か所で決める。
  #
  # **事故の形は決まっている。** 本番確認のために手元の設定へ Live の鍵を入れ、
  # 戻し忘れたまま開発を続けて、ローカルの操作で実際の請求が起きる。
  # 鍵は見た目がほぼ同じなので、入っていること自体には気づけない。
  #
  # そこで、
  #   1. 鍵と署名シークレットは**必ず同じモードのものを組で選ぶ**
  #   2. 手元（development / test）で Live の鍵は**既定で拒む**
  #   3. 拒んだときは鍵を渡さない。決済の機能だけが止まり、**課金は起きない**
  #
  # 逃げ道は1つだけ用意する（`ALLOW_LIVE_STRIPE_LOCALLY=true`）。
  # 手元から本番の決済を確かめたい場面は実際にあるが、**毎回明示させる**。
  module KeySelection
    TEST_KEY_PATTERN = /\A(sk|rk)_test_/
    LOCAL_LIVE_ESCAPE = "ALLOW_LIVE_STRIPE_LOCALLY"

    Selected = Struct.new(:api_key, :webhook_secret, :mode, :refusal, keyword_init: true) do
      def refused? = refusal.present?
    end

    module_function

    # env: ENV 相当のハッシュ。local: 手元（development / test）か
    def select(env:, local:)
      mode = requested_mode(env)
      api_key = pick(env, mode, "SECRET_KEY")
      webhook_secret = pick(env, mode, "WEBHOOK_SECRET")

      if refuse_local_live?(api_key: api_key, local: local, env: env)
        return Selected.new(
          api_key: nil, webhook_secret: nil, mode: "live",
          refusal: "手元の環境に Live の鍵が指定されています。実際の請求が起きるため使いません" \
                   "（どうしても使うなら #{LOCAL_LIVE_ESCAPE}=true）"
        )
      end

      Selected.new(api_key: api_key, webhook_secret: webhook_secret, mode: mode_of(api_key))
    end

    def refuse_local_live?(api_key:, local:, env:)
      live_key?(api_key) && local && env[LOCAL_LIVE_ESCAPE] != "true"
    end

    # `STRIPE_MODE` があればそれに従う。無ければモード別の変数は見ない
    def requested_mode(env)
      env["STRIPE_MODE"].to_s.downcase.presence
    end

    # モードを明示していれば `STRIPE_TEST_*` / `STRIPE_LIVE_*` を先に見る。
    # **無ければ従来の `STRIPE_*` に落ちる**（いまの本番はこちらで動いている）
    def pick(env, mode, suffix)
      scoped = mode && env["STRIPE_#{mode.upcase}_#{suffix}"].presence
      scoped || env["STRIPE_#{suffix}"].presence
    end

    def live_key?(key)
      key.present? && !key.match?(TEST_KEY_PATTERN)
    end

    def mode_of(key)
      return "none" if key.blank?

      live_key?(key) ? "live" : "test"
    end

    # 起動時に決めた署名シークレット。
    # 決まっていない環境（初期化子を通らない単体テスト等）では ENV に落ちる
    def webhook_secret
      Rails.application.config.x.stripe_webhook_secret.presence || ENV["STRIPE_WEBHOOK_SECRET"]
    end
  end
end
