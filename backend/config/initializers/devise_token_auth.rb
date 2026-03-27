# frozen_string_literal: true

DeviseTokenAuth.setup do |config|
  # 開発環境での確認メール送信をスキップ
  config.send_confirmation_email = false

  # devise の confirmable チェックを通すためにバイパスしない
  config.bypass_sign_in = false

  # トークンの有効期限（デフォルト: 2週間）
  # config.token_lifespan = 2.weeks
end
