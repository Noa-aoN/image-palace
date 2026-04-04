class GenerateImageJob < ApplicationJob
  queue_as :default

  # OpenAI レート制限・ネットワーク障害に対して指数バックオフでリトライ
  # 15s → 60s → 240s の間隔で最大3回リトライ（計4回実行）
  # 全リトライ消費後に failed にする
  retry_on StandardError, wait: :polynomially_longer, attempts: 3 do |job, error|
    item_id = job.arguments[0]
    item = Item.find_by(id: item_id)
    item&.update(generation_status: "failed")
    Rails.logger.error "[GenerateImageJob] ALL RETRIES EXHAUSTED item_id=#{item_id} error=#{error.message}"
  end

  OPEN_TIMEOUT = 10
  READ_TIMEOUT = 60

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

      item.update!(generation_status: "processing")
      Rails.logger.info "[GenerateImageJob] START item_id=#{item.id} prompt=#{item.title}"

      normalized = NormalizePromptService.call(item.title)
      cached = force_generate ? nil : SharedMedia.for_prompt(normalized).detect { |shared| blob_available?(shared.file.blob) }

      if cached
        Rails.logger.info "[GenerateImageJob] CACHE HIT prompt=#{normalized} shared_media_id=#{cached.id}"
        attach_from_shared_media(item, cached)
      else
        if !force_generate && SharedMedia.for_prompt(normalized).exists?
          Rails.logger.warn "[GenerateImageJob] CACHE STALE prompt=#{normalized}"
        end
        Rails.logger.info "[GenerateImageJob] CACHE MISS prompt=#{normalized}"
        result = GenerateImageService.call(prompt: item.title)
        shared_media = SharedMedia.create!(
          normalized_prompt: normalized,
          user_id: item.user_id,
          metadata: result.metadata
        )
        download_and_attach(shared_media, result.url)
        attach_from_shared_media(item, shared_media)
      end

      item.update!(generation_status: "completed")
      Rails.logger.info "[GenerateImageJob] COMPLETE item_id=#{item.id}"
    end
    # rescue を置かない → 例外は retry_on に伝播させる
  end

  private

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

  def download_and_attach(shared_media, url)
    require "open-uri"
    require "stringio"

    payload = URI.open(url, open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT, &:read) # rubocop:disable Security/Open

    shared_media.file.attach(
      io: StringIO.new(payload),
      filename: "#{SecureRandom.uuid}.png",
      content_type: "image/png"
    )
  end

  def blob_available?(blob)
    return false if blob.blank?

    service = blob.service
    return true unless service.respond_to?(:path_for)

    File.exist?(service.path_for(blob.key))
  end
end
