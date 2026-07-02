require "stringio"

# プロフィールアイコン（avatar）を非同期生成して User に添付するジョブ。
# GeneratePointImageJob（非Item・単一 has_one_attached）を雛形にしつつ、
# アバターは個人固有なので SharedMedia キャッシュは使わない。
class GenerateAvatarJob < ApplicationJob
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

  NETWORK_ERRORS = [
    EOFError,
    Errno::ECONNRESET,
    Faraday::ConnectionFailed,
    Faraday::SSLError,
    Faraday::TimeoutError,
    Net::ReadTimeout,
    OpenSSL::SSL::SSLError
  ].freeze

  CONTENT_POLICY_MARKERS = /moderation_blocked|content[_ ]?policy|safety system/i
  QUOTA_ERROR_CODES = %w[
    billing_hard_limit_reached billing_limit_reached billing_limit_user_error insufficient_quota
  ].freeze

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

  def user_facing_error_message(error)
    return quota_error_message if quota_error?(error)

    case error
    when Faraday::BadRequestError
      if content_policy_violation?(error)
        "入力がコンテンツポリシーに反するため画像を生成できませんでした。別の語でお試しください。"
      else
        "入力が曖昧なため画像を生成できませんでした。別の語や具体的な表現でお試しください。"
      end
    when *NETWORK_ERRORS
      "通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。"
    else
      "画像生成に失敗しました。時間を置いて再試行してください。"
    end
  end

  def quota_error_message
    "現在、画像生成を一時的に利用できません。時間をおいて再度お試しいただくか、運営者にお問い合わせください。"
  end

  def non_retryable?(error)
    error.is_a?(Faraday::BadRequestError) || quota_error?(error)
  end

  def quota_error?(error)
    QUOTA_ERROR_CODES.include?(openai_error_code(error).to_s)
  end

  def content_policy_violation?(error)
    body = openai_error_body(error)
    marker = "#{error.message} #{body&.dig('error', 'code')} #{body&.dig('error', 'message')}"
    CONTENT_POLICY_MARKERS.match?(marker)
  end

  def openai_error_body(error)
    return nil unless error.respond_to?(:response) && error.response.is_a?(Hash)

    body = error.response[:body]
    body = parse_json(body) if body.is_a?(String)
    body.is_a?(Hash) ? body : nil
  end

  def openai_error_code(error)
    body = openai_error_body(error)
    return nil unless body

    body.dig("error", "code") || body.dig("error", "type")
  end

  def parse_json(str)
    JSON.parse(str)
  rescue JSON::ParserError
    nil
  end
end
