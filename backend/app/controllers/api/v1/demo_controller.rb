module Api
  module V1
    # 体験用の宮殿の入口。**認証が要らない、ただ1つの書き込み口。**
    #
    # 押すと、その人専用の宮殿がその場で建ち、通常の画面へそのまま入れる。
    # ログイン情報を配る必要がなく、配るのは URL だけで済む。
    #
    # ## Cookie を使わない理由
    #
    # 画面（imagepalace.app）と API（api.imagepalace.app）はオリジンが違い、
    # CORS で credentials を許していない。**Cookie は届かない。**
    # 許すように変えると、他の全エンドポイントの前提まで変わってしまう。
    #
    # かわりに、署名付きの合鍵（`resume_token`）を返す。
    # 画面はこれを手元に置き、次に押したとき一緒に送る。
    # 署名があるので**他人の宮殿を指すものは作れない**。
    # トークンを localStorage に置いている今の作りとも揃う。
    #
    # ## 守りは3つ重ね
    #
    #   合鍵        … 生きている宮殿があれば、作らずそこへ戻す（ここが一番効く）
    #   Rack::Attack … 入口の粗い網
    #   DB の数え    … 1日と同時の上限。プロセスをまたいで正確に効く
    #
    # **IP だけに頼らない。** 学校・会場・会社は全員が同じ IP なので、
    # IP で絞ると、いちばん来てほしい人たちを巻き込む。
    class DemoController < ApplicationController
      def create
        result = ::Demo::Session.call(resume_token: params[:resume_token])
        user = result.user

        render json: {
          reused: result.reused?,
          user: user.token_validation_response,
          tokens: user.create_new_auth_token,
          resume_token: ::Demo::Session.resume_token_for(user),
          expires_at: user.created_at + ::Demo::Session::LIFETIME
        }, status: result.created ? :created : :ok
      rescue ::Demo::Session::Unavailable => e
        render json: { error: e.message, code: "demo_unavailable" }, status: :service_unavailable
      end
    end
  end
end
