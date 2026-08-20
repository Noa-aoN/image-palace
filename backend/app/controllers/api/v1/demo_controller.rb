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
      # 終わるときだけ、誰なのかが要る（作るときは認証が無い）
      before_action :authenticate_user!, only: :destroy
      # 消したあとに認証ヘッダーを付け直そうとすると、
      # **もう居ない利用者を読みに行って落ちる**（404 になっていた）
      skip_after_action :update_auth_header, only: :destroy

      # 入口が開いているか。**認証が要らない**（LP から読むため）。
      #
      # 中身は何も返さない。開いているかどうかだけ。
      # これがあると、閉じているときに**押せる見た目のまま断る**のを避けられる
      def show
        render json: { open: ::Demo::Session.open? }
      end

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

      # 体験を終える。**宮殿ごと片付ける。**
      #
      # 「出る」に実体を持たせる。中身は毎回まったく同じなので、
      # 押し間違えても失うものが無い。同時に立てられる数の枠も戻る。
      #
      # 体験用の口座しか消せない。**普通の利用者がここへ来ても、何も起きない**
      # （退会は `DELETE /account` の側で、体験用には禁じてある）。
      def destroy
        user = current_user
        return head(:no_content) unless user&.demo?

        Rails.logger.info "[Demo] 体験を終える user_id=#{user.id}"
        user.destroy!
        head :no_content
      end
    end
  end
end
