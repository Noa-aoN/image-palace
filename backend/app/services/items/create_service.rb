module Items
  class CreateService
    Result = Struct.new(:item, keyword_init: true)

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
      item.medias.create!(
        url: result.url,
        media_type: "image",
        metadata: result.metadata,
        position: 0
      )
      item.update!(generation_status: "completed")
    rescue => e
      item.update!(generation_status: "failed")
      Rails.logger.error "[CreateService] 画像生成失敗 item_id=#{item.id} error=#{e.message}"
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
