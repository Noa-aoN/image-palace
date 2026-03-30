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

      # generation_status は pending のまま返す
      # 後続ブランチで GenerateCardImageJob.perform_later(item.id) を呼び出し、
      # ジョブ側で processing → completed に更新する

      Result.new(item:)
    end

    private

    def default_item_type_id
      type = ItemType.find_by(name: "term")
      unless type
        raise ActiveRecord::RecordNotFound, "Default ItemType 'term' not found. Please run 'rails db:seed'."
      end
      type.id
    end
  end
end
