module Api
  module V1
    class TagsController < BaseController
      before_action :set_tag, only: [ :update, :destroy ]

      def index
        tags = current_user.tags
                           .left_joins(:item_tags)
                           .select("tags.*, COUNT(item_tags.id) AS item_count")
                           .group("tags.id")
                           .order(:name)

        render json: { tags: tags.map { |t| serialize_tag(t) } }
      end

      def update
        @tag.update!(tag_params)
        render json: serialize_tag(@tag)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @tag.destroy!
        head :no_content
      end

      private

      def set_tag
        @tag = current_user.tags.find(params[:id])
      end

      def tag_params
        params.require(:tag).permit(:name)
      end

      def serialize_tag(tag)
        count = tag.has_attribute?(:item_count) ? tag.item_count : tag.item_tags.size
        { id: tag.id, name: tag.name, item_count: count }
      end
    end
  end
end
