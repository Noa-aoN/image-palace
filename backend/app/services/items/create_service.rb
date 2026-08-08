module Items
  class CreateService
    # 生成の可否はクレジット残高で決まる（1クレジット = 1枚）。固定の月間枚数上限は無い。
    # クレジット残高が不足していて生成できない
    class InsufficientCredits < StandardError; end
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

      # 無料枠は当月分を lazy 付与してから残高で判定・消費する。
      @user.ensure_current_period_credits!
      cost = Billing::CreditCost.call(kind: :item_generation)
      item = nil

      @user.with_lock do
        raise InsufficientCredits, "クレジットが不足しています" if @user.available_credit_points < cost

        item = @user.items.create!(
          title: @params[:title],
          item_type_id: @params[:item_type_id] || default_item_type_id,
          generation_status: "pending",
          # 単語をそのまま渡す経路では下ごしらえを作らない。pending のままだと
          # 画面に「作成中…」が出たきり終わらない
          brief_status: prompt_source == "word" ? "none" : "pending",
          # スタイル未指定（おまかせ）なら、ユーザーのデフォルト画像スタイルにフォールバックする
          style: @params[:style].presence || @user.setting&.default_image_style.presence,
          aspect_ratio: (@params[:aspect_ratio].presence ||
                        @user.setting&.default_aspect_ratio.presence ||
                        AspectRatios::DEFAULT),
          custom_prompt: @params[:custom_prompt].presence,
          framing: @params[:framing].presence,
          prompt_source: prompt_source
        )
        @user.consume_credits!(cost, item: item)
      end

      # 指示の作り方はカードごと。単語をそのまま渡すなら下ごしらえを挟まず画像へ直行する。
      #
      # 「調べてから」なら、意味・説明づくりも指示の書き直しもこの連鎖の中でやる。
      # 意味が出来上がる前に書き直しを始めては意味がないので、別ジョブに分けない。
      research = prompt_source == "research"
      force = @params[:force_generate] == true
      if prompt_source == "word"
        GenerateImageJob.perform_later(item.id, force_generate: force)
      else
        GenerateBriefJob.perform_later(item.id, force_generate: force, research_level: research ? meaning_level : nil)
      end
      # 意味の自動生成: 作成時に generate_meaning が明示指定されればそれを優先し、
      # 指定がなければユーザー設定（auto_generate_meanings）にフォールバックする。
      # 調べてから作る場合は上の連鎖が先に作るので、ここでは積まない（二重生成になる）
      GenerateMeaningJob.perform_later(item.id, meaning_level) if generate_meaning? && !research
      # タグの自動生成: generate_tags が明示指定されればそれを優先し、
      # 指定がなければユーザー設定（auto_generate_tags）にフォールバックする
      GenerateTagsJob.perform_later(item.id) if generate_tags?
      Result.new(item: item)
    end

    private

    # 画像への指示の作り方（word / brief / research）。未指定・不正な値は既定へ倒す。
    # research は指示がカード固有になるぶん画像キャッシュが効かなくなるので、明示指定のときだけ。
    def prompt_source
      @prompt_source ||= begin
        value = @params[:prompt_source].to_s
        Item::PROMPT_SOURCES.include?(value) ? value : Item::DEFAULT_PROMPT_SOURCE
      end
    end

    # 作成時に generate_meaning が渡された場合はその真偽値を、なければユーザー設定を使う
    def generate_meaning?
      if @params.key?(:generate_meaning)
        ActiveModel::Type::Boolean.new.cast(@params[:generate_meaning])
      else
        @user.setting&.auto_generate_meanings
      end
    end

    # 説明の詳しさレベル（未指定・不正値は simple）
    def meaning_level
      Meaning.normalize_level(@params[:generate_meaning_level])
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
