module Api
  module V1
    class ItemsController < BaseController
      before_action :set_item, only: [ :show, :update, :destroy, :retry ]

      def index
        items = current_user.items
                  .includes(medias: { file_attachment: :blob })
                  .order(created_at: :desc)
        render json: { items: items.map { |i| serialize_item(repair_item_if_media_missing(i)) } }
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
        render json: serialize_item(result.item), status: :accepted
      rescue Items::CreateService::MonthlyLimitExceeded => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def show
        render json: serialize_item(repair_item_if_media_missing(item))
      end

      # タイトル等の編集。画像の再生成は伴わず、既存メディアと生成ステータスは保持する
      def update
        item.update!(item_update_params)
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

      private

      def item_params
        params.require(:item).permit(:title, :item_type_id, :force_generate)
      end

      def item_update_params
        params.require(:item).permit(:title, :item_type_id)
      end

      def serialize_item(item)
        {
          id: item.id,
          title: item.title,
          generation_status: item.generation_status,
          generation_error: item.generation_error,
          media: serialize_media(item.primary_media),
          created_at: item.created_at
        }
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
                            .includes(medias: { file_attachment: :blob })
                            .find(params[:id])
      end

      attr_reader :item
    end
  end
end
