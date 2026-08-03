require "stringio"

# キャンバス／スペース／ボックスのカバー画像を非同期生成して添付するジョブ。
#
# GenerateAvatarJob と同じ形。カバーもその人のその入れ物だけのものなので、
# SharedMedia のキャッシュは使わない（同じ文でも別の絵になってよい）。
#
# 対象は GlobalID で渡す。3つのモデルで同じ処理を使い回すため。
class GenerateCoverImageJob < ApplicationJob
  include ImageGenerationErrorHandling

  queue_as :default

  # GenerateImageJob と同じリトライ戦略（15s → 60s → 240s、最大3回）。
  retry_on StandardError, wait: :polynomially_longer, attempts: 3 do |job, error|
    record = job.arguments[0]
    job.send(:mark_failed!, record, error)
    Rails.logger.error "[GenerateCoverImageJob] ALL RETRIES EXHAUSTED #{job.send(:label, record)} error=#{error.message}"
  end

  def perform(record, prompt, style = nil)
    return if record.nil?

    prompt = prompt.to_s.strip
    return if prompt.blank?

    record.update_cover_generation_status!("processing")
    Rails.logger.info "[GenerateCoverImageJob] START #{label(record)}"

    result = GenerateImageService.call(prompt: build_prompt(prompt, style))
    optimized = OptimizeImageService.call(image_data: result.image_data, content_type: result.content_type)

    attach!(record, optimized)
    # 作った絵をすぐ見せる。カスタム以外のままだと生成物が表示されない
    record.update!(cover_type: "custom")
    record.update_cover_generation_status!("completed")
    Rails.logger.info "[GenerateCoverImageJob] COMPLETE #{label(record)}"
  rescue StandardError => e
    # 400（ポリシー違反・曖昧な入力）や請求上限はリトライしても回復しないため即 failed にする。
    raise unless non_retryable?(e)

    Rails.logger.warn "[GenerateCoverImageJob] NON-RETRYABLE #{label(record)} code=#{openai_error_code(e) || e.class} -> failed"
    mark_failed!(record, e)
  end

  private

  def attach!(record, optimized)
    record.cover_image.purge if record.cover_image.attached?
    record.cover_image.attach(
      io: StringIO.new(optimized.data),
      filename: "cover-#{SecureRandom.uuid}.#{optimized.extension}",
      content_type: optimized.content_type
    )

    record.cover_thumb.purge if record.cover_thumb.attached?
    return unless optimized.thumb_data

    record.cover_thumb.attach(
      io: StringIO.new(optimized.thumb_data),
      filename: "cover-thumb-#{SecureRandom.uuid}.webp",
      content_type: "image/webp"
    )
  end

  # カード・アバターと同じ整形。スタイル修飾＋見切れ回避＋文字回避を付ける。
  def build_prompt(prompt, style)
    parts = [ prompt ]
    modifier = PromptBuilderService::STYLE_MODIFIERS[style.to_s.presence]
    parts << modifier if modifier
    parts << PromptBuilderService::FRAMING_HINT
    parts << PromptBuilderService::NO_TEXT_HINT
    parts.join(", ")
  end

  def mark_failed!(record, error)
    return if record.nil?

    record.mark_cover_generation_failed!(user_facing_error_message(error))
  rescue ActiveRecord::RecordNotFound
    # 生成中に消されたときは何もしない
  end

  def label(record)
    return "record=nil" if record.nil?

    "#{record.class.name.downcase}_id=#{record.id}"
  end
end
