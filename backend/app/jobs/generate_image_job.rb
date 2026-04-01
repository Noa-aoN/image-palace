class GenerateImageJob < ApplicationJob
  queue_as :default

  OPEN_TIMEOUT = 10
  READ_TIMEOUT = 30

  def perform(item_id, force_generate: false)
    item = Item.find_by(id: item_id)
    return unless item

    item.update!(generation_status: "processing")
    Rails.logger.info "[GenerateImageJob] START item_id=#{item.id} prompt=#{item.title}"

    normalized = NormalizePromptService.call(item.title)
    cached = force_generate ? nil : SharedMedia.for_prompt(normalized).first

    if cached
      Rails.logger.info "[GenerateImageJob] CACHE HIT prompt=#{normalized} shared_media_id=#{cached.id}"
      attach_from_shared_media(item, cached)
    else
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
  rescue => e
    item&.update(generation_status: "failed")
    Rails.logger.error "[GenerateImageJob] ERROR item_id=#{item_id} error=#{e.message} backtrace=#{e.backtrace.first(3).join(' | ')}"
  end

  private

  def attach_from_shared_media(item, shared_media)
    media = item.medias.create!(
      media_type: "image",
      metadata: shared_media.metadata,
      position: 0
    )
    media.file.attach(shared_media.file.blob)
  end

  def download_and_attach(shared_media, url)
    require "open-uri"
    URI.open(url, open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT) do |file| # rubocop:disable Security/Open
      shared_media.file.attach(
        io: file,
        filename: "#{SecureRandom.uuid}.png",
        content_type: "image/png"
      )
    end
  end
end
