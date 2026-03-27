# frozen_string_literal: true

# OmniAuth 2.x ではGETリクエストがデフォルト無効。
# ブラウザからのOAuth開始（GET /api/v1/auth/google_oauth2）を許可する。
OmniAuth.config.allowed_request_methods = %i[get post]
OmniAuth.config.silence_get_warning = true

# プロバイダー登録は devise.rb の config.omniauth に一本化
# （ここに OmniAuth::Builder ブロックを書くと二重登録になるため不要）
