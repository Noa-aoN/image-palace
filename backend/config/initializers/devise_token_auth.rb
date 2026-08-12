# frozen_string_literal: true

DeviseTokenAuth.setup do |config|
  # 開発環境での確認メール送信をスキップ
  config.send_confirmation_email = false

  # devise の confirmable チェックを通すためにバイパスしない
  config.bypass_sign_in = false

  # トークンの有効期限（gem の既定は 2 週間）。
  # トークンはフロントの localStorage に保存されるため、盗まれた場合の有効期間を短くしたい。
  #
  # change_headers_on_each_request が既定 true で、リクエストごとにトークンが再発行される。
  # つまり能動的に使っているユーザーはログアウトされず、
  # 「この日数アクセスが無かった場合に再ログイン」という意味になる。
  config.token_lifespan = ENV.fetch("TOKEN_LIFESPAN_DAYS", "7").to_i.days

  # パスワードを変えるときは、**いまのパスワードを必ず聞く**。
  #
  # 既定は聞かない。トークンさえ奪えば、パスワードごと乗っ取れてしまう
  # （置き忘れた端末・持ち出されたトークンで、本人が締め出される）。
  # :password にすると、変更の対象がパスワードのときだけ現在のものを求める。
  config.check_current_password_before_update = :password
end
