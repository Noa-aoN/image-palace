module Api
  module V1
    class ItemsController < BaseController
      before_action :set_item, only: [ :show, :update, :destroy, :retry, :meaning ]

      DEFAULT_PER_PAGE = 24
      MAX_PER_PAGE = 100

      def index
        scope = current_user.items.order(created_at: :desc)
        scope = scope.joins(:item_tags).where(item_tags: { tag_id: params[:tag_id] }) if params[:tag_id].present?
        if params[:q].present?
          like = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].strip)}%"
          scope = scope.where("items.title ILIKE ?", like)
        end

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
        monthly_count = current_user.items.created_this_month.count

        render json: {
          total_count: current_user.items.count,
          pending_count: current_user.items.where(generation_status: "pending").count,
          processing_count: current_user.items.where(generation_status: "processing").count,
          failed_count: current_user.items.where(generation_status: "failed").count,
          monthly_count: monthly_count,
          monthly_limit: monthly_limit,
          monthly_remaining: [ monthly_limit - monthly_count, 0 ].max
        }
      end

      def create
        result = Items::CreateService.call(user: current_user, params: item_params)
        assign_tags!(result.item)
        render json: serialize_item(result.item.reload), status: :accepted
      rescue Items::CreateService::MonthlyLimitExceeded => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def show
        render json: serialize_item(repair_item_if_media_missing(item))
      end

      # タイトル・種別・意味の編集。画像の再生成は伴わず、既存メディアと生成ステータスは保持する
      def update
        Item.transaction do
          item.update!(item_update_params)
          upsert_meaning!
          assign_tags!(item)
        end
        render json: serialize_item(item.reload)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        item.destroy!
        head :no_content
      end

      def retry
        current_item = repair_item_if_media_missing(item)
        unless current_item.generation_status == "failed"
          return render json: { error: "failed 状態のカードのみ再生成できます" }, status: :unprocessable_entity
        end

        current_item.update_generation_status!("pending")
        GenerateImageJob.perform_later(current_item.id, force_generate: false)
        render json: serialize_item(current_item.reload), status: :accepted
      end

      # 意味・説明を AI で生成（同期）。詳細画面の「意味を生成」ボタンから呼ばれる。
      def meaning
        GenerateMeaningService.call(item: item)
        render json: serialize_item(item.reload), status: :ok
      rescue GenerateMeaningService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#meaning] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "意味の生成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      private

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
        params.require(:item).permit(:title, :item_type_id, :force_generate, :style, :custom_prompt)
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
          meaning.update!(definition: definition)
        end
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
          style: item.style,
          tags: item.tags.map { |t| { id: t.id, name: t.name } },
          media: serialize_media(item.primary_media),
          created_at: item.created_at
        }
      end

      def serialize_item_type(item_type)
        return nil unless item_type

        { id: item_type.id, name: item_type.name, label: item_type.label }
      end

      def serialize_media(media)
        return nil unless media&.file&.attached?
        return nil unless blob_available?(media.file.blob)

        blob = media.file.blob

        {
          id: media.id,
          url: media_url(blob),
          thumb_url: thumbnail_url(blob),
          media_type: media.media_type
        }
      end

      def media_url(blob)
        cdn_base = ENV["CDN_BASE_URL"]
        return rails_storage_proxy_url(blob) if blob.service_name == "local"
        return url_for(blob) if cdn_base.blank?

        "#{cdn_base}/#{blob.key}"
      end

      def thumbnail_url(blob)
        return media_url(blob) unless blob.image?
        return media_url(blob) if blob.service_name == "local"

        variant = blob.variant(resize_to_limit: [ 480, 480 ]).processed
        url_for(variant)
      rescue LoadError, StandardError
        media_url(blob)
      end

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

      def blob_available?(blob)
        return false if blob.blank?

        service = blob.service
        return true unless service.respond_to?(:path_for)

        File.exist?(service.path_for(blob.key))
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
