class GenerateImageJob < ApplicationJob
  queue_as :default

  # OpenAI レート制限・ネットワーク障害に対して指数バックオフでリトライ
  # 15s → 60s → 240s の間隔で最大3回リトライ（計4回実行）
  # 全リトライ消費後に failed にする
  retry_on StandardError, wait: :polynomially_longer, attempts: 3 do |job, error|
    item_id = job.arguments[0]
    job.send(:mark_failed!, item_id, error)
    Rails.logger.error "[GenerateImageJob] ALL RETRIES EXHAUSTED item_id=#{item_id} error=#{error.message}"
  end

  def perform(item_id, force_generate: false)
    item = Item.find_by(id: item_id)
    return unless item

    item.with_lock do
      item.reload
      current_media = item.primary_media
      if item.generation_status == "completed" &&
         current_media&.file&.attached? &&
         blob_available?(current_media.file.blob) &&
         !force_generate
        Rails.logger.info "[GenerateImageJob] SKIP item_id=#{item.id} status=completed"
        return
      end

      item.update_generation_status!("processing")
      # スタイル・カスタム指示を反映した有効プロンプト。キャッシュキーと生成の両方に使う
      effective_prompt = PromptBuilderService.effective_prompt(item)
      normalized = NormalizePromptService.call(effective_prompt)
      # プロンプト全文はユーザー入力（個人情報・機密語句を含み得る）なのでログに残さない。
      # 相関用にハッシュの先頭と長さだけ記録する。
      prompt_key = Digest::SHA256.hexdigest(normalized)[0, 8]
      Rails.logger.info "[GenerateImageJob] START item_id=#{item.id} prompt_key=#{prompt_key} prompt_len=#{effective_prompt.length}"

      cached = force_generate ? nil : SharedMedia.for_prompt(normalized).detect { |shared| blob_available?(shared.file.blob) }

      if cached
        Rails.logger.info "[GenerateImageJob] CACHE HIT prompt_key=#{prompt_key} shared_media_id=#{cached.id}"
        attach_from_shared_media(item, cached)
      else
        if !force_generate && SharedMedia.for_prompt(normalized).exists?
          Rails.logger.warn "[GenerateImageJob] CACHE STALE prompt_key=#{prompt_key}"
        end
        Rails.logger.info "[GenerateImageJob] CACHE MISS prompt_key=#{prompt_key}"
        result = GenerateImageService.call(prompt: effective_prompt)
        shared_media = SharedMedia.create!(
          normalized_prompt: normalized,
          user_id: item.user_id,
          metadata: result.metadata
        )
        attach_image_data(shared_media, result.image_data, result.content_type)
        attach_from_shared_media(item, shared_media)
      end

      item.update_generation_status!("completed")
      Rails.logger.info "[GenerateImageJob] COMPLETE item_id=#{item.id}"
    end
    # rescue を置かない → 例外は retry_on に伝播させる
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

  def attach_from_shared_media(item, shared_media)
    media = item.primary_media || item.medias.build
    media.assign_attributes(
      media_type: "image",
      metadata: shared_media.metadata,
      position: 0
    )
    media.save!

    item.medias.where.not(id: media.id).destroy_all
    media.file.attach(shared_media.file.blob)
  end

  def attach_image_data(shared_media, image_data, content_type)
    require "stringio"

    # 保存前にリサイズ + WebP 変換でストレージ・配信コストを抑える
    optimized = OptimizeImageService.call(image_data: image_data, content_type: content_type)

    shared_media.file.attach(
      io: StringIO.new(optimized.data),
      filename: "#{SecureRandom.uuid}.#{optimized.extension}",
      content_type: optimized.content_type
    )
  end

  def blob_available?(blob)
    return false if blob.blank?

    service = blob.service
    return true unless service.respond_to?(:path_for)

    File.exist?(service.path_for(blob.key))
  end

  def mark_failed!(item_id, error)
    item = Item.find_by(id: item_id)
    return unless item

    item.mark_generation_failed!(
      message: user_facing_error_message(error),
      code: error.class.name
    )
  end

  # OpenAI のコンテンツポリシー違反は 400 系で返り、本文に moderation_blocked /
  # content_policy_violation / safety system 等のマーカーを含む。事前のブロックリストを
  # すり抜けた入力の最終防衛として、専用のユーザー向けメッセージに振り分ける。
  CONTENT_POLICY_MARKERS = /moderation_blocked|content[_ ]?policy|safety system/i

  def user_facing_error_message(error)
    case error
    when Faraday::BadRequestError
      if CONTENT_POLICY_MARKERS.match?(error.message.to_s)
        "入力がコンテンツポリシーに反するため画像を生成できませんでした。別の単語でお試しください。"
      else
        "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。"
      end
    when *NETWORK_ERRORS
      "通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。"
    else
      "画像生成に失敗しました。時間を置いて再試行してください。"
    end
  end
end
