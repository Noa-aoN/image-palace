# frozen_string_literal: true

# Stripe の鍵はバックエンドのみに保持する（フロントから直接呼び出さない）。
# 未設定の環境では API 呼び出しを行う機能だけが無効になり、起動は妨げない。
#
# どの鍵を使うかの判断は Billing::KeySelection が持つ。
# **手元の環境に Live の鍵が入っていたら使わない**（実際の請求が起きるため）。
#
# to_prepare に置くのは、初期化子の時点では app/ の定数がまだ読めないため。
# ここなら読み込みが済んでおり、開発中の再読み込みにも追随する。
Rails.application.config.to_prepare do
  next unless defined?(Stripe)

  selection = Billing::KeySelection.select(env: ENV, local: Rails.env.local?)

  if selection.refused?
    # 値は出さない。何が起きたかだけ残す
    Rails.logger.warn("[stripe] 鍵を使いません: #{selection.refusal}")
    warn("[stripe] #{selection.refusal}")
    Stripe.api_key = nil
  elsif selection.api_key.present?
    Stripe.api_key = selection.api_key
  end

  # 署名シークレットは**鍵と同じモードのものを組で持つ**。
  # 片方だけ別モードだと、決済は通るのに webhook が全部弾かれる
  Rails.application.config.x.stripe_webhook_secret = selection.webhook_secret
end
