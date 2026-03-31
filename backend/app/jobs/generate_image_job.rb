class GenerateImageJob < ApplicationJob
  queue_as :default

  OPEN_TIMEOUT = 10
  READ_TIMEOUT = 30

  def perform(item_id)
    item = Item.find_by(id: item_id)
    return unless item

    item.update!(generation_status: "processing")

    result = GenerateImageService.call(prompt: item.title)

    media = item.medias.create!(
      media_type: "image",
      metadata: result.metadata,
      position: 0
    )
    download_and_attach(media, result.url)
    item.update!(generation_status: "completed")
  rescue => e
    item&.update(generation_status: "failed")
    Rails.logger.error "[GenerateImageJob] 画像生成失敗 item_id=#{item_id} error=#{e.message}"
  end

  private

  def download_and_attach(media, url)
    require "open-uri"
    URI.open(url, open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT) do |file| # rubocop:disable Security/Open
      media.file.attach(
        io: file,
        filename: "#{SecureRandom.uuid}.png",
        content_type: "image/png"
      )
    end
  end
end
