module Api
  module V1
    module Account
      # プロフィールアイコン（avatar）の生成トリガと削除。
      # 生成は非同期（GenerateAvatarJob）。クレジットは生成トリガ時に前払い消費する。
      class AvatarsController < BaseController
        before_action -> { deny_for_demo!(:generate_image) }, only: :create

        include AvatarSerialization

        MAX_PROMPT = 300

        def create
          prompt = params.dig(:avatar, :prompt).to_s.strip
          style = params.dig(:avatar, :style).to_s.presence

          return render_error("プロンプトを入力してください。") if prompt.blank?
          return render_error("プロンプトが長すぎます（#{MAX_PROMPT}文字以内）。") if prompt.length > MAX_PROMPT

          moderation = Moderation::PromptModerator.call(prompt)
          if moderation.blocked?
            Rails.logger.warn(
              "[Moderation] BLOCKED avatar user_id=#{current_user.id} category=#{moderation.category} term=#{moderation.term}"
            )
            return render_error("入力に利用できない表現が含まれています。別の語でお試しください。")
          end

          current_user.ensure_current_period_credits!
          cost = ::Billing::CreditCost.call(kind: :avatar)

          current_user.with_lock do
            raise User::InsufficientCredits unless current_user.can_afford?(cost)

            current_user.consume_credits!(cost)
            current_user.update_avatar_status!("pending")
          end

          GenerateAvatarJob.perform_later(current_user.id, prompt, style)
          render json: profile_json(current_user), status: :accepted
        rescue User::InsufficientCredits
          render json: { error: "クレジットが不足しています" }, status: :unprocessable_entity
        end

        def destroy
          current_user.avatar.purge_later if current_user.avatar.attached?
          current_user.avatar_thumb.purge_later if current_user.avatar_thumb.attached?
          current_user.update!(avatar_generation_status: nil, avatar_generation_error: nil)
          render json: profile_json(current_user)
        end

        private

        def render_error(message, status = :unprocessable_entity)
          render json: { error: message }, status: status
        end
      end
    end
  end
end
