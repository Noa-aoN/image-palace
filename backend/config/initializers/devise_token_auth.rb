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

  # 戻り先の許可リスト。**メールを送れるようにする前に、必ずこれが要る。**
  #
  # 未設定（gem の既定）だと `redirect_url` / `confirm_success_url` に
  # 任意のホストを指定でき、devise_token_auth はそこへ**トークンを付けて飛ばす**。
  #
  #   passwords#edit … `Url.generate(@redirect_url, reset_password_token: ...)`
  #   omniauth      … `build_auth_url` が access-token / client / uid をURLに載せる
  #
  # つまり「パスワードをお忘れですか」を1回踏ませるだけで乗っ取れる。
  # いまはメールが出ないので成立しないが、**出るようにした瞬間に穴になる**。
  #
  # 許可するのは自分たちのフロントの、実際に使う画面だけ。
  # `*` はワイルドカード（gem が正規表現へ直す）。
  # **オリジンの後ろの `/` を落とさないこと。** 落とすと
  # `https://imagepalace.app.example.com/` のような別ホストまで通る。
  #
  # 値は起動時に読む。オリジンを変えたら再起動が要る。
  frontend_origins = [ ENV["FRONTEND_URL"], *ENV.fetch("CORS_ORIGINS", "").split(",") ].filter_map do |raw|
    uri = begin
      URI.parse(raw.to_s.strip)
    rescue URI::InvalidURIError
      nil
    end
    next unless uri && %w[http https].include?(uri.scheme) && uri.host.present?

    port = uri.port && ![ 80, 443 ].include?(uri.port) ? ":#{uri.port}" : ""
    "#{uri.scheme}://#{uri.host}#{port}"
  end.uniq

  # 1件も読めなければ手元の既定に落とす。**空の配列にはしない。**
  # 空にすると gem は「どれにも一致しない」と見なし、新規登録まで落ちる
  frontend_origins = [ "http://localhost:3000" ] if frontend_origins.empty?

  # `/login` は新規登録の既定の戻り先（`confirm_success_url`）。ここを外すと signup が落ちる
  config.redirect_whitelist = frontend_origins.flat_map do |origin|
    [ "#{origin}/reset-password*", "#{origin}/login*" ]
  end
end
