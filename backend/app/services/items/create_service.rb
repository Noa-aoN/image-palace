module Items
  class CreateService
    FREE_ITEM_LIMIT_PER_MONTH = 100
    class MonthlyLimitExceeded < StandardError; end

    Result = Struct.new(:item, keyword_init: true)

    def self.call(user:, params:)
      new(user:, params:).call
    end

    def initialize(user:, params:)
      @user = user
      @params = params
    end

    def call
      item = nil

      @user.with_lock do
        monthly_count = @user.items.created_this_month.count
        if monthly_count >= FREE_ITEM_LIMIT_PER_MONTH
          raise MonthlyLimitExceeded, "今月の生成枚数の上限（#{FREE_ITEM_LIMIT_PER_MONTH}枚）に達しました"
        end

        item = @user.items.create!(
          title: @params[:title],
          item_type_id: @params[:item_type_id] || default_item_type_id,
          generation_status: "pending"
        )
      end

      GenerateImageJob.perform_later(item.id, force_generate: @params[:force_generate] == true)
      # ユーザー設定で「意味の自動生成」が ON の場合のみ、意味生成も非同期で実行する
      GenerateMeaningJob.perform_later(item.id) if @user.setting&.auto_generate_meanings
      Result.new(item: item)
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
