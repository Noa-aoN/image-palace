require "stringio"

# プロフィールアイコン（avatar）を非同期生成して User に添付するジョブ。
# GeneratePointImageJob（非Item・単一 has_one_attached）を雛形にしつつ、
# アバターは個人固有なので SharedMedia キャッシュは使わない。
class GenerateAvatarJob < ApplicationJob
  include ImageGenerationErrorHandling

  queue_as :default

  # GenerateImageJob と同じリトライ戦略（15s → 60s → 240s、最大3回）。
  # 全リトライ消費後に failed にする。
  retry_on StandardError, wait: :polynomially_longer, attempts: 3 do |job, error|
    user_id = job.arguments[0]
    job.send(:mark_failed!, user_id, error)
    Rails.logger.error "[GenerateAvatarJob] ALL RETRIES EXHAUSTED user_id=#{user_id} error=#{error.message}"
  end

  def perform(user_id, prompt, style = nil)
    user = User.find_by(id: user_id)
    return unless user

    prompt = prompt.to_s.strip
    return if prompt.blank?

    user.update_avatar_status!("processing")
    Rails.logger.info "[GenerateAvatarJob] START user_id=#{user.id}"

    result = GenerateImageService.call(prompt: build_prompt(prompt, style))
    optimized = OptimizeImageService.call(image_data: result.image_data, content_type: result.content_type)

    user.avatar.attach(
      io: StringIO.new(optimized.data),
      filename: "avatar-#{SecureRandom.uuid}.#{optimized.extension}",
      content_type: optimized.content_type
    )
    if optimized.thumb_data
      user.avatar_thumb.attach(
        io: StringIO.new(optimized.thumb_data),
        filename: "avatar-thumb-#{SecureRandom.uuid}.webp",
        content_type: "image/webp"
      )
    end

    user.update_avatar_status!("completed")
    Rails.logger.info "[GenerateAvatarJob] COMPLETE user_id=#{user.id}"
  rescue StandardError => e
    # 400（ポリシー違反・曖昧な入力）や請求上限はリトライしても回復しないため即 failed にする。
    raise unless non_retryable?(e)

    Rails.logger.warn "[GenerateAvatarJob] NON-RETRYABLE user_id=#{user_id} code=#{openai_error_code(e) || e.class} -> failed"
    mark_failed!(user_id, e)
  end

  private

  # アイコン用の軽いプロンプト整形。スタイル修飾＋見切れ回避＋文字回避を付ける。
  def build_prompt(prompt, style)
    parts = [ prompt ]
    modifier = PromptBuilderService::STYLE_MODIFIERS[style.to_s.presence]
    parts << modifier if modifier
    parts << PromptBuilderService::FRAMING_HINT
    parts << PromptBuilderService::NO_TEXT_HINT
    parts.join(", ")
  end

  def mark_failed!(user_id, error)
    user = User.find_by(id: user_id)
    return unless user

    user.mark_avatar_failed!(user_facing_error_message(error))
  end
end
