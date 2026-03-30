module Api
  module V1
    class ItemsController < BaseController
      def index
        items = current_user.items.includes(:medias).order(created_at: :desc)
        render json: { items: items.map { |i| serialize_item(i) } }
      end

      def create
        result = Items::CreateService.call(user: current_user, params: item_params)
        render json: serialize_item(result.item), status: :accepted
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def show
        item = current_user.items.includes(:medias).find(params[:id])
        render json: serialize_item(item)
      end

      private

      def item_params
        params.require(:item).permit(:title, :item_type_id)
      end

      def serialize_item(item)
        media = item.medias.first
        {
          id: item.id,
          title: item.title,
          generation_status: item.generation_status,
          media: media ? { id: media.id, url: media.url, media_type: media.media_type } : nil,
          created_at: item.created_at
        }
      end
    end
  end
end
