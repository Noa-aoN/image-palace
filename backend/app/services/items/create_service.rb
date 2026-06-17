module Items
  class CreateService
    FREE_ITEM_LIMIT_PER_MONTH = 100
    class MonthlyLimitExceeded < StandardError; end
    # ブロックリストに該当する不適切なプロンプトを生成前に弾く
    class ContentBlocked < StandardError; end

    Result = Struct.new(:item, keyword_init: true)

    def self.call(user:, params:)
      new(user:, params:).call
    end

    def initialize(user:, params:)
      @user = user
      @params = params
    end

    def call
      moderate!

      item = nil

      @user.with_lock do
        monthly_count = @user.monthly_generation_count
        if monthly_count >= FREE_ITEM_LIMIT_PER_MONTH
          raise MonthlyLimitExceeded, "今月の生成枚数の上限（#{FREE_ITEM_LIMIT_PER_MONTH}枚）に達しました"
        end

        item = @user.items.create!(
          title: @params[:title],
          item_type_id: @params[:item_type_id] || default_item_type_id,
          generation_status: "pending",
          style: @params[:style].presence,
          custom_prompt: @params[:custom_prompt].presence
        )
      end

      GenerateImageJob.perform_later(item.id, force_generate: @params[:force_generate] == true)
      # 意味の自動生成: 作成時に generate_meaning が明示指定されればそれを優先し、
      # 指定がなければユーザー設定（auto_generate_meanings）にフォールバックする
      GenerateMeaningJob.perform_later(item.id) if generate_meaning?
      # タグの自動生成: generate_tags が明示指定されればそれを優先し、
      # 指定がなければユーザー設定（auto_generate_tags）にフォールバックする
      GenerateTagsJob.perform_later(item.id) if generate_tags?
      Result.new(item: item)
    end

    private

    # 作成時に generate_meaning が渡された場合はその真偽値を、なければユーザー設定を使う
    def generate_meaning?
      if @params.key?(:generate_meaning)
        ActiveModel::Type::Boolean.new.cast(@params[:generate_meaning])
      else
        @user.setting&.auto_generate_meanings
      end
    end

    # 作成時に generate_tags が渡された場合はその真偽値を、なければユーザー設定を使う
    def generate_tags?
      if @params.key?(:generate_tags)
        ActiveModel::Type::Boolean.new.cast(@params[:generate_tags])
      else
        @user.setting&.auto_generate_tags
      end
    end

    # タイトルとカスタムプロンプト（どちらも OpenAI に渡るユーザー入力）を生成前に検査する。
    # 違反語を含む場合はアイテムを作らず・ジョブも積まずに ContentBlocked を投げ、監査ログを残す。
    def moderate!
      [ @params[:title], @params[:custom_prompt] ].each do |text|
        next if text.blank?

        result = Moderation::PromptModerator.call(text)
        next if result.allowed?

        Rails.logger.warn(
          "[Moderation] BLOCKED user_id=#{@user.id} category=#{result.category} term=#{result.term}"
        )
        raise ContentBlocked, "入力に利用できない表現が含まれているため作成できませんでした。別の単語でお試しください。"
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
