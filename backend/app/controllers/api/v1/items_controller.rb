module Api
  module V1
    class ItemsController < BaseController
      FREE_ITEM_LIMIT_PER_MONTH = 100

      def index
        items = current_user.items
                  .includes(medias: { file_attachment: :blob })
                  .order(created_at: :desc)
        render json: { items: items.map { |i| serialize_item(i) } }
      end

      def create
        monthly_count = current_user.items.where(created_at: Time.current.beginning_of_month..).count
        if monthly_count >= FREE_ITEM_LIMIT_PER_MONTH
          return render json: { error: "今月の生成枚数の上限（#{FREE_ITEM_LIMIT_PER_MONTH}枚）に達しました" }, status: :unprocessable_entity
        end

        result = Items::CreateService.call(user: current_user, params: item_params)
        render json: serialize_item(result.item), status: :accepted
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def show
        item = current_user.items
                 .includes(medias: { file_attachment: :blob })
                 .find(params[:id])
        render json: serialize_item(item)
      end

      def destroy
        item = current_user.items.find(params[:id])
        item.destroy!
        head :no_content
      end

      def retry
        item = current_user.items.find(params[:id])
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
          media: serialize_media(item.medias.first),
          created_at: item.created_at
        }
      end

      def serialize_media(media)
        return nil unless media&.file&.attached?

        { id: media.id, url: media_url(media.file.blob), media_type: media.media_type }
      end

      def media_url(blob)
        cdn_base = ENV["CDN_BASE_URL"]
        return url_for(blob) if cdn_base.blank?

        "#{cdn_base}/#{blob.key}"
      end
    end
  end
end
