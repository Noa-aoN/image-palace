module Api
  module V1
    class ItemsController < BaseController
      include ItemSerialization

      before_action :set_item, only: [ :show, :update, :destroy, :retry, :meaning, :generate_tags, :fact_check ]

      DEFAULT_PER_PAGE = 24
      MAX_PER_PAGE = 100
      # 並び替えのホワイトリスト（ユーザー入力を直接 ORDER BY に渡さない）
      SORTABLE_COLUMNS = { "created_at" => "items.created_at", "title" => "items.title" }.freeze
      SORT_DIRECTIONS = %w[asc desc].freeze

      def index
        scope = current_user.items
        if params[:status] == "needs_correction"
          # ファクトチェックで「正しい」以外＝訂正待ち（サブクエリで重複を避ける）
          flagged_ids = current_user.items.joins(:meanings)
                                    .where(meanings: { fact_check_status: %w[incorrect doubtful] }).select(:id)
          scope = scope.where(id: flagged_ids)
        elsif Item::GENERATION_STATUSES.include?(params[:status])
          scope = scope.where(generation_status: params[:status])
        end
        scope = scope.joins(:item_tags).where(item_tags: { tag_id: params[:tag_id] }) if params[:tag_id].present?
        if params[:q].present?
          like = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].strip)}%"
          scope = scope.where("items.title ILIKE ?", like)
        end
        scope = scope.order(sort_clause)

        per = pagination_per
        page = pagination_page
        total_count = scope.count
        total_pages = total_count.zero? ? 0 : (total_count.to_f / per).ceil

        items = scope
                  .includes(:item_type, :meanings, :tags, medias: { file_attachment: :blob })
                  .limit(per)
                  .offset((page - 1) * per)

        render json: {
          items: items.map { |i| serialize_item(repair_item_if_media_missing(i)) },
          meta: {
            page: page,
            per: per,
            total_count: total_count,
            total_pages: total_pages
          }
        }
      end

      SUGGEST_LIMIT = 8

      # 検索オートコンプリート用の軽量サジェスト（タイトルのみ）
      def suggest
        q = params[:q].to_s.strip
        return render(json: { suggestions: [] }) if q.blank?

        like = "%#{ActiveRecord::Base.sanitize_sql_like(q)}%"
        items = current_user.items
                            .where("items.title ILIKE ?", like)
                            .order(created_at: :desc)
                            .limit(SUGGEST_LIMIT)

        render json: { suggestions: items.map { |i| { id: i.id, title: i.title } } }
      end

      def summary
        monthly_limit = Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH
        # カード＋名前付きスペースポイントの合算（月間生成上限を共有）
        monthly_count = current_user.monthly_generation_count

        render json: {
          total_count: current_user.items.count,
          pending_count: current_user.items.where(generation_status: "pending").count,
          processing_count: current_user.items.where(generation_status: "processing").count,
          failed_count: current_user.items.where(generation_status: "failed").count,
          boxes_count: current_user.boxes.count,
          views_count: current_user.views.count,
          spaces_count: current_user.spaces.count,
          monthly_count: monthly_count,
          monthly_limit: monthly_limit,
          monthly_remaining: [ monthly_limit - monthly_count, 0 ].max
        }
      end

      # 詳細画面の前後ナビゲーション用。画像・意味・タグを含めず ID だけ返す。
      def navigation
        ids = current_user.items.order(sort_clause).pluck(:id)
        render json: { ids: ids }
      end

      def create
        result = Items::CreateService.call(user: current_user, params: item_params)
        assign_tags!(result.item)
        render json: serialize_item(result.item.reload), status: :accepted
      rescue Items::CreateService::InsufficientCredits, Items::CreateService::MonthlyLimitExceeded => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue Items::CreateService::ContentBlocked => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def show
        render json: serialize_item(repair_item_if_media_missing(item))
      end

      # タイトル・種別・意味の編集。画像の再生成は伴わず、既存メディアと生成ステータスは保持する
      def update
        # 単語名を変えたら、説明への以前のファクトチェック判定は無効化する
        title_changed = item_update_params.key?(:title) && item_update_params[:title].to_s != item.title
        Item.transaction do
          item.update!(item_update_params)
          upsert_meaning!
          assign_tags!(item)
          clear_fact_check!(item.primary_meaning) if title_changed
        end
        render json: serialize_item(item.reload)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        item.destroy!
        head :no_content
      end

      # 一括削除。current_user のカードのみ対象（他人のカードは無視）。
      # destroy_all で各レコードのコールバックを走らせ、画像（ActiveStorage）も片付ける。
      BULK_DESTROY_LIMIT = 200

      def bulk_destroy
        ids = Array(params[:ids]).map { |id| id.to_s.strip }.reject(&:blank?).uniq.first(BULK_DESTROY_LIMIT)
        return render(json: { deleted_ids: [] }, status: :ok) if ids.empty?

        deleted = current_user.items.where(id: ids).destroy_all
        render json: { deleted_ids: deleted.map(&:id) }, status: :ok
      end

      # 再生成。failed だけでなく completed（生成成功済み）からも再生成できる。
      # 任意で custom_prompt / style の指示を受け取り、曖昧な入力の補足やニュアンス調整に使う。
      def retry
        current_item = repair_item_if_media_missing(item)
        unless %w[failed completed].include?(current_item.generation_status)
          return render json: { error: "生成が完了または失敗したカードのみ再生成できます" }, status: :unprocessable_entity
        end

        was_completed = current_item.generation_status == "completed"
        instructions = regeneration_instructions
        apply_regeneration_instructions!(current_item, instructions)

        # 意味・説明を参考にするオプション（既定オフ）。プロンプトが変わるため再生成扱いにする。
        use_meaning = regeneration_use_meaning?

        # completed の再生成や指示の変更時はキャッシュを使わず新しい画像を生成する
        force = was_completed || instructions.present? || use_meaning
        current_item.update_generation_status!("pending")
        GenerateImageJob.perform_later(current_item.id, force_generate: force, use_meaning: use_meaning)
        render json: serialize_item(current_item.reload), status: :accepted
      rescue Items::CreateService::ContentBlocked => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # 意味・説明を AI で生成（同期）。詳細画面の「意味を生成」ボタンや一括操作から呼ばれる。
      # level（brief / simple / detailed）で詳しさを選べる。未指定は simple。
      # only_if_empty=true なら、既に説明があるカードはスキップする（未設定の穴埋め用）。
      def meaning
        if truthy?(params[:only_if_empty]) && item.primary_meaning.present?
          return render json: { status: "skipped", reason: "already_has_meaning" }, status: :ok
        end

        GenerateMeaningService.call(item: item, level: params[:level])
        render json: serialize_item(item.reload), status: :ok
      rescue GenerateMeaningService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#meaning] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "意味の生成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # タグを AI で生成（同期）。詳細画面の「AIで生成」ボタンや一括操作から呼ばれる。
      # replace=true: AI結果で置き換え。false（既定）: 既存タグへ union で追加。
      # only_if_empty=true: 既にタグがあるカードはスキップ（未設定の穴埋め用）。
      def generate_tags
        if truthy?(params[:only_if_empty]) && item.tags.exists?
          return render json: { status: "skipped", reason: "already_tagged" }, status: :ok
        end

        GenerateTagsService.call(item: item, replace: truthy?(params[:replace]))
        render json: serialize_item(item.reload), status: :ok
      rescue GenerateTagsService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#generate_tags] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "タグの生成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # カードの説明（meaning）が事実として正しいかを AI でファクトチェックする（同期）。
      # 説明が無いカードはスキップを返す。
      def fact_check
        result = GenerateFactCheckService.call(item: item)
        return render json: { status: "skipped", reason: "no_meaning" }, status: :ok if result.nil?

        render json: serialize_item(item.reload), status: :ok
      rescue GenerateFactCheckService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#fact_check] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "ファクトチェックに失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      private

      # クエリ/フォームの真偽値（"true"/"1" 等）を bool に変換する
      def truthy?(value)
        ActiveModel::Type::Boolean.new.cast(value)
      end

      # 並び替え句を組み立てる。カラム・方向は許可リストからのみ採用し、安定化のため created_at を副キーにする
      def sort_clause
        column = SORTABLE_COLUMNS.fetch(params[:sort], "items.created_at")
        direction = SORT_DIRECTIONS.include?(params[:direction]) ? params[:direction] : "desc"
        Arel.sql("#{column} #{direction}, items.created_at DESC")
      end

      # 1始まり。不正値・0以下は 1 に丸める
      def pagination_page
        page = params[:page].to_i
        page < 1 ? 1 : page
      end

      # 1〜MAX_PER_PAGE にクランプ。未指定・不正値は DEFAULT_PER_PAGE
      def pagination_per
        per = params[:per].to_i
        return DEFAULT_PER_PAGE if per <= 0

        per.clamp(1, MAX_PER_PAGE)
      end

      def item_params
        params.require(:item).permit(
          :title, :item_type_id, :force_generate, :style, :custom_prompt, :aspect_ratio,
          :generate_meaning, :generate_meaning_level, :generate_tags
        )
      end

      # 再生成時の指示（custom_prompt / style）。指定されたキーのみを返す。
      def regeneration_instructions
        item_param = params[:item]
        return {} unless item_param.respond_to?(:permit)

        item_param.permit(:custom_prompt, :style).to_h.symbolize_keys.reject { |_, v| v.nil? }
      end

      # 再生成時に意味・説明を参考にするか（既定 false）。boolean 以外は false に丸める。
      def regeneration_use_meaning?
        ActiveModel::Type::Boolean.new.cast(params.dig(:item, :use_meaning)) || false
      end

      # 指示が渡された場合のみ、custom_prompt をモデレーションして item に反映する
      def apply_regeneration_instructions!(target, instructions)
        return if instructions.empty?

        moderate_instruction!(instructions[:custom_prompt])
        target.update!(instructions)
      end

      def moderate_instruction!(text)
        return if text.blank?

        result = Moderation::PromptModerator.call(text)
        return if result.allowed?

        Rails.logger.warn(
          "[Moderation] BLOCKED user_id=#{current_user.id} category=#{result.category} term=#{result.term}"
        )
        raise Items::CreateService::ContentBlocked,
              "入力に利用できない表現が含まれているため再生成できませんでした。別の表現でお試しください。"
      end

      def item_update_params
        params.require(:item).permit(:title, :item_type_id)
      end

      # item[meaning] が渡された場合のみ日本語の意味を upsert する。
      # 空文字なら既存の意味を削除する（未指定キーは無視）
      def upsert_meaning!
        item_param = params[:item]
        return unless item_param.respond_to?(:key?) && item_param.key?(:meaning)

        definition = item_param[:meaning].to_s.strip
        meaning = item.meanings.find_or_initialize_by(language_code: "ja")

        if definition.blank?
          meaning.destroy! if meaning.persisted?
        else
          # 説明を書き換えたら、以前のファクトチェック結果は無効化する（古い判定が残らないように）
          if meaning.definition != definition
            meaning.fact_check_status = nil
            meaning.fact_check_comment = nil
            meaning.fact_check_suggestion = nil
            meaning.fact_check_title_suggestion = nil
            meaning.fact_checked_at = nil
          end
          meaning.definition = definition
          meaning.save!
        end
      end

      # 既存（永続化済み）の meaning のファクトチェック結果をクリアする
      def clear_fact_check!(meaning)
        return unless meaning&.persisted?

        meaning.update!(
          fact_check_status: nil,
          fact_check_comment: nil,
          fact_check_suggestion: nil,
          fact_check_title_suggestion: nil,
          fact_checked_at: nil
        )
      end

      # item[tags] にタグ名配列が渡された場合のみ、その内容でタグを設定する（未指定なら変更しない）。
      # 存在しないタグ名は作成、外れたタグは関連解除する。
      def assign_tags!(target)
        names = params.dig(:item, :tags)
        return if names.nil?

        tags = Array(names).map { |n| n.to_s.strip }.reject(&:blank?).uniq(&:downcase).first(50).map do |name|
          current_user.tags.find_or_create_by!(name: name)
        end
        target.tags = tags
      end

      def serialize_item(item)
        {
          id: item.id,
          title: item.title,
          generation_status: item.generation_status,
          generation_error: item.generation_error,
          item_type: serialize_item_type(item.item_type),
          meaning: item.primary_meaning&.definition,
          meaning_example: item.primary_meaning&.example_sentence,
          meaning_level: item.primary_meaning&.detail_level,
          fact_check_status: item.primary_meaning&.fact_check_status,
          fact_check_comment: item.primary_meaning&.fact_check_comment,
          fact_check_suggestion: item.primary_meaning&.fact_check_suggestion,
          fact_check_title_suggestion: item.primary_meaning&.fact_check_title_suggestion,
          fact_checked_at: item.primary_meaning&.fact_checked_at,
          style: item.style,
          custom_prompt: item.custom_prompt,
          tags: item.tags.map { |t| { id: t.id, name: t.name } },
          media: serialize_media(item.primary_media),
          created_at: item.created_at
        }
      end

      def serialize_item_type(item_type)
        return nil unless item_type

        { id: item_type.id, name: item_type.name, label: item_type.label }
      end

      # ItemSerialization#serialize_media を、生成メタ情報（ⓘ 用）を足して上書きする。
      # サムネは media_thumb_url が事前生成済み thumb を CDN 直配信し、無ければ variant にフォールバックする。
      def serialize_media(media)
        return nil unless media&.file&.attached?
        return nil unless blob_available?(media.file.blob)

        blob = media.file.blob

        {
          id: media.id,
          url: media_url(blob),
          thumb_url: media_thumb_url(media, blob),
          blur: media.metadata&.dig("lqip"),
          media_type: media.media_type,
          generation_info: media_generation_info(media)
        }
      end

      # 画像生成時のメタ情報を、ホワイトリストしたキーだけで返す（内部キーは出さない）。
      # 全て空なら nil（旧データ・キャッシュ由来でメタが無いカードは項目を出さない）。
      GENERATION_INFO_KEYS = %w[provider model quality size revised_prompt].freeze

      def media_generation_info(media)
        metadata = media.metadata
        return nil if metadata.blank?

        info = GENERATION_INFO_KEYS.each_with_object({}) do |key, acc|
          value = metadata[key]
          acc[key] = value if value.present?
        end
        info.presence
      end

      # media_url / thumbnail_url / blob_available? は ItemSerialization concern を再利用する
      # （CDN 直配信・local プロキシ対応。以前はこのクラスに重複定義していた）。

      MISSING_MEDIA_REPAIR_GRACE_PERIOD = 30.seconds

      def repair_item_if_media_missing(item)
        return item unless item.generation_status == "completed"

        media = item.primary_media
        return item if media&.file&.attached? && blob_available?(media.file.blob)
        return item if item.updated_at >= MISSING_MEDIA_REPAIR_GRACE_PERIOD.ago

        item.mark_generation_failed!(
          message: "画像ファイルが見つからなかったため、再生成が必要です。",
          code: "missing_media"
        )
        item.reload
      end

      def set_item
        @item = current_user.items
                            .includes(:item_type, :meanings, :tags, medias: { file_attachment: :blob })
                            .find(params[:id])
      end

      attr_reader :item
    end
  end
end
