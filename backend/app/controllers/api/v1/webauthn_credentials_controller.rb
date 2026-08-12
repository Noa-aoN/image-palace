module Api
  module V1
    # Passkey の登録と管理。
    #
    # **登録は必ず認証済みの状態で行う。** 誰でも鍵を足せると、
    # 乗っ取った人が自分の端末を追加して居座れる。
    #
    # 栓（PASSKEY_ENABLED）が閉じているときは、画面を消すだけでなく
    # ここも閉じる。API を直に叩けば通ってしまうため。
    class WebauthnCredentialsController < BaseController
      # 秘密が通る経路。どこにも溜めさせない（弾かれた応答も含める）
      prepend_before_action :do_not_store!
      before_action :require_passkey_enabled!
      before_action :set_credential, only: [ :update, :destroy ]
      # 外すのは、乗っ取った人が正規の鍵を消して締め出す道になる。
      # 名前を変えるだけなら求めない（消えるものが無い）
      before_action :require_strong_auth!, only: [ :destroy ]

      # 登録済みの鍵。名前・登録日・最後に使った日を返す
      def index
        render json: { credentials: current_user.webauthn_credentials.recent.map { |c| serialize(c) } }
      end

      # 登録の始め。認証器へ渡す指示を作り、challenge を控える。
      # **この時点ではまだ鍵を保存しない**（作れたかどうかは次で確かめる）
      def create
        options = WebAuthn::Credential.options_for_create(
          user: { id: current_user.webauthn_handle, name: current_user.email, display_name: display_name },
          # 既に登録した鍵を伝える。同じ認証器で二重に作らせない
          exclude: current_user.webauthn_credentials.pluck(:external_id),
          authenticator_selection: {
            # passkey（端末に残る鍵）を優先しつつ、対応しない鍵も拒まない
            resident_key: "preferred",
            # 指紋・顔・PIN のいずれかを必ず通す。持っているだけでは通さない
            user_verification: "required"
          }
        )

        WebauthnChallenge.issue!(purpose: "registration", challenge: options.challenge, user: current_user)
        render json: { options: options.as_json }
      end

      # 認証器が作った鍵を確かめて保存する
      def callback
        credential = WebAuthn::Credential.from_create(credential_params)
        challenge = WebauthnChallenge.consume!(
          challenge: params[:challenge], purpose: "registration", user: current_user
        )
        return render_error("やり直してください。時間が経ちすぎたか、すでに使われた手続きです。") if challenge.nil?

        # 署名・端末証明・鍵の解釈は gem に任せる（自前で書かない）
        credential.verify(challenge.challenge)

        record = current_user.webauthn_credentials.create!(
          external_id: credential.id,
          public_key: credential.public_key,
          sign_count: credential.sign_count,
          nickname: params[:nickname].presence
        )
        audit!("passkey.registered", record)
        render json: { credential: serialize(record) }, status: :created
      rescue WebAuthn::Error => e
        # 何が違ったかは伝えない（総当たりの手がかりになる）
        Rails.logger.warn "[Passkey] VERIFY FAILED user_id=#{current_user.id} #{e.class}"
        render_error("確認できませんでした。もう一度お試しください。")
      rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique
        render_error("この鍵はすでに登録されています。")
      end

      # 名前を変える。どれがどの端末か分からなくなるのを防ぐためのもの
      def update
        @credential.update!(nickname: params[:nickname].to_s.strip.presence)
        render json: { credential: serialize(@credential) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # 外す。**最後の1本でも外せる。**
      #
      # 残さないと、機種変更のときに古い鍵を消せない。
      # 締め出しは、認証アプリ・復旧コード・rake task で防ぐ
      def destroy
        @credential.destroy!
        audit!("passkey.removed", @credential)
        render json: { removed: true }
      end

      private

      def set_credential
        @credential = current_user.webauthn_credentials.find(params[:id])
      end

      def credential_params
        params.require(:credential).permit(:id, :type, :rawId, :authenticatorAttachment,
                                           response: [ :clientDataJSON, :attestationObject, transports: [] ]).to_h
      end

      def display_name
        current_user.name.presence || current_user.email.to_s.split("@").first
      end

      def serialize(credential)
        {
          id: credential.id,
          nickname: credential.nickname,
          display_name: credential.display_name,
          created_at: credential.created_at,
          last_used_at: credential.last_used_at
        }
      end

      # 栓が閉じているときは、画面だけでなくここも閉じる
      def require_passkey_enabled!
        return if ::Auth::StrongAuth.passkey_enabled?

        render json: { error: "この機能は現在ご利用いただけません。" }, status: :service_unavailable
      end

      def do_not_store!
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
      end

      # 秘密は残さない。誰が・いつ・何をしたかだけ
      def audit!(action, credential)
        AdminAuditLog.record!(
          actor: current_user, action: action, target: current_user,
          details: { credential_id: credential.id, nickname: credential.nickname }.compact
        )
      end

      def render_error(message)
        render json: { error: message }, status: :unprocessable_entity
      end
    end
  end
end
