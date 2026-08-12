module Api
  module V1
    # 二要素認証（TOTP）の設定。
    #
    # **まだ必須にしない。** 設定していなくても運営の入口には入れる。
    # いきなり必須にすると、設定を終える前のログアウトで締め出される。
    # 必須化は、運営全員が設定を終えたことを確かめてから行う。
    #
    # 解除は自分の分だけ。他人の二要素を画面から外せるようにすると、
    # 権限を取られたときに二要素ごと剥がされる（他人の分は rake task で扱う）。
    class TotpController < BaseController
      # 総当たりを許さない。コードは6桁しかない
      before_action :throttle_guard!, only: [ :confirm ]
      # 外すのは、乗っ取った人が守りを剥がす道になる
      before_action :require_strong_auth!, only: [ :destroy ]
      # 秘密鍵と復旧コードが通る経路。どこにも溜めさせない。
      # prepend にするのは、認証で弾かれた応答にも同じ扱いを掛けるため
      # （401 に秘密は無いが、経路ごと「溜めない」で揃えておくほうが穴が無い）
      prepend_before_action :do_not_store!

      # いまの状態。画面が「設定する」を出すかどうかの判断に使う
      def show
        render json: {
          enrolled: current_user.totp_enrolled?,
          recovery_codes_left: current_user.totp_recovery_codes.size,
          reauthenticated: strongly_authenticated?
        }
      end

      # 登録の始め。秘密鍵を作り、認証アプリへ渡す URI を返す。
      # **この時点では有効にしない**（確認まで進んで初めて有効）
      def create
        secret = current_user.start_totp_enrollment!

        render json: {
          secret: secret,
          # QR にするのは画面側の仕事。画像を作る仕事をサーバーに持ち込まない
          provisioning_uri: ::Auth::Totp.provisioning_uri(secret, account: current_user.email)
        }
      end

      # コードが合えば有効にし、復旧コードを返す。
      # **返すのはこの1回だけ**（保存しているのはハッシュなので、後から出せない）
      def confirm
        codes = current_user.confirm_totp!(params[:code])
        if codes.nil?
          return render json: { error: "コードが合いません。時計がずれていないか確かめてください。" },
                        status: :unprocessable_entity
        end

        # 設定した本人は、その場で確かめ済みとして扱う（この端末だけ）
        StrongAuthSession.record!(user: current_user, client_id: current_client_id, method: "totp")
        render json: { enrolled: true, recovery_codes: codes }
      end

      # 解除。**外すときも本人確認を求める**。
      # 端末を置き忘れた隙に外されると、二要素の意味がなくなる。
      #
      # 確かめ方は共通の口（/reauth）に寄せた。ここで独自にコードを求めると、
      # 確かめた直後にもう一度同じコードを入れることになる。
      # 入力の回数は変わらないのに、手順だけが増える
      def destroy
        current_user.update!(totp_secret: nil, totp_confirmed_at: nil, totp_recovery_codes: [])
        AdminAuditLog.record!(actor: current_user, action: "totp.disabled", target: current_user)
        render json: { enrolled: false }
      end

      private

      # 中身が中身なので、経路上のどこにも残させない
      def do_not_store!
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
      end

      # Rack::Attack は経路ごとの上限。ここは利用者ごとに数える
      # （同じ人が別の網から叩いても効くように）
      ATTEMPT_LIMIT = 10
      ATTEMPT_PERIOD = 5.minutes

      def throttle_guard!
        key = "totp:attempts:#{current_user.id}"
        count = Rails.cache.increment(key, 1, expires_in: ATTEMPT_PERIOD) || 1
        return if count <= ATTEMPT_LIMIT

        Rails.logger.warn "[Totp] THROTTLED user_id=#{current_user.id}"
        render json: { error: "試行が多すぎます。しばらく待ってからお試しください。" },
               status: :too_many_requests
      end
    end
  end
end
