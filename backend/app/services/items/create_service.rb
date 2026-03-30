module Items
  class CreateService
    Result = Struct.new(:item, keyword_init: true)

    OPEN_TIMEOUT = 10
    READ_TIMEOUT = 30

    def self.call(user:, params:)
      new(user:, params:).call
    end

    def initialize(user:, params:)
      @user = user
      @params = params
    end

    def call
      item = @user.items.create!(
        title: @params[:title],
        item_type_id: @params[:item_type_id] || default_item_type_id,
        generation_status: "pending"
      )

      generate_and_attach_image(item)

      Result.new(item: item.reload)
    end

    private

    def generate_and_attach_image(item)
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
      item.update!(generation_status: "failed")
      Rails.logger.error "[CreateService] 画像生成失敗 item_id=#{item.id} error=#{e.message}"
    end

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

    def default_item_type_id
      type = ItemType.find_by(name: "term")
      unless type
        raise ActiveRecord::RecordNotFound, "Default ItemType 'term' not found. Please run 'rails db:seed'."
      end
      type.id
    end
  end
end
