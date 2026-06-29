class GeneratePointImageJob < ApplicationJob
  queue_as :default

  # GenerateImageJob と同じリトライ戦略（15s → 60s → 240s、最大3回）。
  # 全リトライ消費後に failed にする。
  retry_on StandardError, wait: :polynomially_longer, attempts: 3 do |job, error|
    point_id = job.arguments[0]
    job.send(:mark_failed!, point_id, error)
    Rails.logger.error "[GeneratePointImageJob] ALL RETRIES EXHAUSTED point_id=#{point_id} error=#{error.message}"
  end

  def perform(space_point_id, force_generate: false)
    point = SpacePoint.find_by(id: space_point_id)
    return unless point
    return if point.name.blank?

    point.with_lock do
      point.reload
      if point.generation_status == "completed" &&
         point.image.attached? &&
         blob_available?(point.image.blob) &&
         !force_generate
        Rails.logger.info "[GeneratePointImageJob] SKIP point_id=#{point.id} status=completed"
        return
      end

      point.update_generation_status!("processing")

      prompt = point.name
      normalized = NormalizePromptService.call(prompt)
      prompt_key = Digest::SHA256.hexdigest(normalized)[0, 8]
      Rails.logger.info "[GeneratePointImageJob] START point_id=#{point.id} prompt_key=#{prompt_key}"

      cached = force_generate ? nil : SharedMedia.for_prompt(normalized).detect { |shared| blob_available?(shared.file.blob) }

      if cached
        Rails.logger.info "[GeneratePointImageJob] CACHE HIT prompt_key=#{prompt_key} shared_media_id=#{cached.id}"
        shared_media = cached
      else
        Rails.logger.info "[GeneratePointImageJob] CACHE MISS prompt_key=#{prompt_key}"
        result = GenerateImageService.call(prompt: prompt)
        shared_media = SharedMedia.create!(
          normalized_prompt: normalized,
          user_id: point.space.user_id,
          metadata: result.metadata
        )
        attach_image_data(shared_media, result.image_data, result.content_type)
      end

      attach_from_shared_media(point, shared_media)
      point.update!(
        generation_status: "completed",
        metadata: point.metadata_without_generation_error.merge(
          "revised_prompt" => shared_media.metadata&.dig("revised_prompt"),
          "lqip" => shared_media.metadata&.dig("lqip")
        ).compact
      )
      Rails.logger.info "[GeneratePointImageJob] COMPLETE point_id=#{point.id}"
    end
  rescue StandardError => e
    # 400（ポリシー違反・曖昧な入力）や請求上限はリトライしても回復しないため即 failed にする。
    raise unless non_retryable?(e)

    Rails.logger.warn "[GeneratePointImageJob] NON-RETRYABLE point_id=#{space_point_id} -> failed"
    mark_failed!(space_point_id, e)
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

  def attach_from_shared_media(point, shared_media)
    point.image.attach(shared_media.file.blob)
    # 事前生成済みサムネがあれば参照（CDN 直配信用）。無い古いキャッシュは未添付のままで OK。
    point.thumb.attach(shared_media.thumb.blob) if shared_media.thumb.attached?
  end

  def attach_image_data(shared_media, image_data, content_type)
    require "stringio"

    # 本体に加え、一覧用サムネ(480px)と LQIP プレースホルダも生成する（GenerateImageJob と同様）。
    optimized = OptimizeImageService.call(image_data: image_data, content_type: content_type)
    shared_media.file.attach(
      io: StringIO.new(optimized.data),
      filename: "#{SecureRandom.uuid}.#{optimized.extension}",
      content_type: optimized.content_type
    )

    if optimized.thumb_data
      shared_media.thumb.attach(
        io: StringIO.new(optimized.thumb_data),
        filename: "#{SecureRandom.uuid}.webp",
        content_type: "image/webp"
      )
    end

    shared_media.update!(metadata: shared_media.metadata.merge("lqip" => optimized.lqip)) if optimized.lqip
  end

  def blob_available?(blob)
    return false if blob.blank?

    service = blob.service
    return true unless service.respond_to?(:path_for)

    File.exist?(service.path_for(blob.key))
  end

  def mark_failed!(point_id, error)
    point = SpacePoint.find_by(id: point_id)
    return unless point

    point.mark_generation_failed!(
      message: user_facing_error_message(error),
      code: error.class.name
    )
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
