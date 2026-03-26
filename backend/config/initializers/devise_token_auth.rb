# frozen_string_literal: true

DeviseTokenAuth.setup do |config|
  # 開発環境での確認メール送信をスキップ
  config.send_confirmation_email = false

  # トークンの有効期限（デフォルト: 2週間）
  # config.token_lifespan = 2.weeks

  # 複数デバイスでのログインを許可
  # config.enable_standard_devise_support = true

  # ユーザー名での認証を許可（email以外）
  # config.default_user_key = :email

  # トークン発行時のコールバック
  # config.on_token_dispatch = :set_current_user

  # 認証ヘッダー名
  # config.headers_names = { 'access-token': 'access-token',
  #                          'client': 'client',
  #                          'expiry': 'expiry',
  #                          'uid': 'uid',
  #                          'token-type': 'Bearer' }

  # 最初のトークン発行時にconfirmed_atを設定するか
  # config.send_confirmation_email = true
end
