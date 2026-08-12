module Api
  module V1
    # 危険な操作の前に、もう一度ご本人か確かめる。
    #
    # 確かめ方は3つ（Passkey / 認証アプリ / 復旧コード）だが、
    # **通ったあとの扱いは同じ**。どれで確かめても、この端末が
    # 「直近に確かめ済み」になるだけで、危険操作の側は手段を知らない。
    #
    # 出口はひとつでも、道筋はひとつにしない。Passkey は
    # 「challenge を配る → 認証器が署名する → 確かめる」の二段が要るので、
    # 無理に1本の口へ押し込まない（押し込むと、どちらの段の話か分からない
    # 引数が並ぶことになる）。
    class ReauthController < BaseController
      # 秘密が通る経路。どこにも溜めさせない（弾かれた応答も含む）
      prepend_before_action :do_not_store!
      before_action :throttle_guard!, only: [ :verify_code, :verify_passkey ]

      # いまの状態。画面が「どれを出すか」を決めるのに使う
      def show
        render json: {
          # ここが見ているのは**危険操作の猶予**（短い方）。
          # 執務室に居られるかどうかは窓が広く、そちらは
          # GET /api/v1/admin/session の strong_auth が返す
          authenticated: strongly_authenticated?,
          methods: ::Auth::StrongAuth.available_methods(current_user),
          window_minutes: StrongAuthSession::WINDOW.in_minutes.to_i,
          admin_window_minutes: StrongAuthSession::ADMIN_WINDOW.in_minutes.to_i
        }
      end

      # Passkey の一段目。challenge を配る。
      # まだ何も通していない（署名を確かめるのは次）
      def passkey_options
        return render_unavailable unless passkey_available?

        options = WebAuthn::Credential.options_for_get(
          allow: current_user.webauthn_credentials.pluck(:external_id),
          user_verification: "required"
        )
        WebauthnChallenge.issue!(purpose: "reauthentication", challenge: options.challenge, user: current_user)
        render json: { options: options.as_json }
      end

      # Passkey の二段目。署名を確かめる
      def verify_passkey
        return render_unavailable unless passkey_available?

        credential = WebAuthn::Credential.from_get(credential_params)
        challenge = WebauthnChallenge.consume!(
          challenge: params[:challenge], purpose: "reauthentication", user: current_user
        )
        return render_failed("やり直してください。時間が経ちすぎたか、すでに使われた手続きです。") if challenge.nil?

        stored = current_user.webauthn_credentials.find_by(external_id: credential.id)
        return render_failed("登録されていない鍵です。") if stored.nil?

        # 署名の検証は gem に任せる。sign_count の扱いもそちらの作法に従う
        credential.verify(challenge.challenge, public_key: stored.public_key, sign_count: stored.sign_count)
        stored.touch_usage!(credential.sign_count)

        succeed!("passkey")
      rescue WebAuthn::Error => e
        # 何が違ったかは伝えない（総当たりの手がかりになる）
        Rails.logger.warn "[StrongAuth] PASSKEY FAILED user_id=#{current_user.id} #{e.class}"
        render_failed("確認できませんでした。もう一度お試しください。")
      end

      # 認証アプリのコード、または復旧コード。
      # **どちらも同じ口で受ける**（利用者にとっては「コードを入れる」1つの操作）
      def verify_code
        unless current_user.totp_enrolled?
          return render_failed("認証アプリが設定されていません。")
        end

        # 復旧コードを使ったかどうかは、記録のために見分ける
        used_recovery = !::Auth::Totp.verify(current_user.totp_secret, params[:code])
        return render_failed("コードが合いません。") unless current_user.verify_totp(params[:code])

        succeed!(used_recovery ? "recovery_code" : "totp")
      end

      private

      def succeed!(method)
        session = StrongAuthSession.record!(user: current_user, client_id: current_client_id, method: method)
        if session.nil?
          # client が無いと、どの端末が通ったのか決められない
          return render_failed("端末を識別できませんでした。入り直してからお試しください。")
        end

        AdminAuditLog.record!(
          actor: current_user, action: "strong_auth.succeeded", target: current_user,
          details: { method: method }
        )
        render json: { authenticated: true, expires_at: session.authenticated_at + StrongAuthSession::WINDOW }
      end

      def passkey_available?
        ::Auth::StrongAuth.passkey_enabled? && current_user.passkey_enrolled?
      end

      def credential_params
        params.require(:credential).permit(
          :id, :type, :rawId, :authenticatorAttachment,
          response: [ :clientDataJSON, :authenticatorData, :signature, :userHandle ]
        ).to_h
      end

      def render_unavailable
        render json: { error: "パスキーはご利用いただけません。" }, status: :unprocessable_entity
      end

      def render_failed(message)
        # 失敗も残す。乗っ取りの試みは、成功だけを見ていても分からない
        AdminAuditLog.record!(
          actor: current_user, action: "strong_auth.failed", target: current_user,
          details: { path: request.path }
        )
        render json: { error: message }, status: :unprocessable_entity
      end

      # Rack::Attack は経路ごとの上限。ここは利用者ごとに数える
      ATTEMPT_LIMIT = 10
      ATTEMPT_PERIOD = 5.minutes

      def throttle_guard!
        key = "reauth:attempts:#{current_user.id}"
        count = Rails.cache.increment(key, 1, expires_in: ATTEMPT_PERIOD) || 1
        return if count <= ATTEMPT_LIMIT

        Rails.logger.warn "[StrongAuth] THROTTLED user_id=#{current_user.id}"
        render json: { error: "試行が多すぎます。しばらく待ってからお試しください。" },
               status: :too_many_requests
      end

      def do_not_store!
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
      end
    end
  end
end
