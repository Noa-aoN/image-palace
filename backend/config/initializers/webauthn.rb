# frozen_string_literal: true

# Passkey / WebAuthn の設定。
#
# == RP ID は後から変えられない ==============================================
#
# **RP ID を変えると、登録済みの鍵がすべて無効になる。** 認証器は
# 「どのドメインの鍵か」を RP ID で覚えており、名前が変われば別物として扱う。
# 利用者から見ると、ある日いきなり Passkey が消える。
#
# だから apex（imagepalace.app）に決め打ちする。サブドメインは apex に包含
# されるので、api. を足しても frontend を分けても、この値は変えなくてよい。
# 逆に api.imagepalace.app にすると、apex のフロントから登録できない。
#
#   フロント: https://imagepalace.app       ← ここから呼ばれる
#   API:      https://api.imagepalace.app   ← ここが検証する
#
# origin は「呼んだ画面のアドレス」なので、フロント側を書く。
# API のアドレスではない（ここを取り違えると、検証が必ず失敗する）。
#
# 手元では localhost。https でなくても、localhost だけは例外として扱われる。
WebAuthn.configure do |config|
  config.allowed_origins = ENV.fetch("WEBAUTHN_ORIGIN", "http://localhost:3000").split(",").map(&:strip)
  config.rp_id = ENV.fetch("WEBAUTHN_RP_ID", "localhost")
  config.rp_name = "IMAGE PALACE"

  # 認証器に触れるまでの持ち時間。長いと、配った challenge が
  # 使えるまま残る時間も延びる
  config.credential_options_timeout = 120_000

  # 端末そのものの証明書（attestation）は求めない。既定のまま。
  #
  # 求めると、どの製品の認証器かが分かる代わりに、証明書の検証と失効の管理を
  # 抱えることになる。ここで守りたいのは「本人か」であって
  # 「どのメーカーの鍵か」ではない。
  #
  # `acceptable_attestation_types` は既定（none を含む）に任せる。
end
