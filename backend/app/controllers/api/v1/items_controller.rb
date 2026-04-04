module Api
  module V1
    class ItemsController < BaseController
      def index
        items = current_user.items
                  .includes(medias: { file_attachment: :blob })
                  .order(created_at: :desc)
        render json: { items: items.map { |i| serialize_item(repair_item_if_media_missing(i)) } }
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
        item = current_user.items
                 .includes(medias: { file_attachment: :blob })
                 .find(params[:id])
        render json: serialize_item(repair_item_if_media_missing(item))
      end

      def destroy
        item = current_user.items.find(params[:id])
        item.destroy!
        head :no_content
      end

      def retry
        item = current_user.items.find(params[:id])
        item = repair_item_if_media_missing(item)
        unless item.generation_status == "failed"
          return render json: { error: "failed 状態のカードのみ再生成できます" }, status: :unprocessable_entity
        end

        item.update!(generation_status: "pending")
        GenerateImageJob.perform_later(item.id, force_generate: false)
        render json: serialize_item(item.reload), status: :accepted
      end

      private

      def item_params
        params.require(:item).permit(:title, :item_type_id, :force_generate)
      end

      def serialize_item(item)
        {
          id: item.id,
          title: item.title,
          generation_status: item.generation_status,
          media: serialize_media(item.primary_media),
          created_at: item.created_at
        }
      end

      def serialize_media(media)
        return nil unless media&.file&.attached?
        return nil unless blob_available?(media.file.blob)

        { id: media.id, url: media_url(media.file.blob), media_type: media.media_type }
      end

      def media_url(blob)
        cdn_base = ENV["CDN_BASE_URL"]
        return rails_storage_proxy_url(blob) if blob.service_name == "local"
        return url_for(blob) if cdn_base.blank?

        "#{cdn_base}/#{blob.key}"
      end

      def repair_item_if_media_missing(item)
        return item unless item.generation_status == "completed"

        media = item.primary_media
        return item if media&.file&.attached? && blob_available?(media.file.blob)

        item.update!(generation_status: "failed")
        item.reload
      end

      def blob_available?(blob)
        return false if blob.blank?

        service = blob.service
        return true unless service.respond_to?(:path_for)

        File.exist?(service.path_for(blob.key))
      end
    end
  end
end
