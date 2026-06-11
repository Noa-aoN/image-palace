module Api
  module V1
    class CollectionsController < BaseController
      include ItemSerialization

      before_action :set_collection, only: [ :show, :update, :destroy, :add_item, :remove_item ]

      def index
        collections = current_user.collections
                                  .recent
                                  .left_joins(:collection_items)
                                  .select("collections.*, COUNT(collection_items.id) AS item_count")
                                  .group("collections.id")

        render json: { collections: collections.map { |c| serialize_collection(c) } }
      end

      def show
        items = @collection.items
                           .includes(:item_type, medias: { file_attachment: :blob })
                           .order("collection_items.created_at DESC")

        render json: serialize_collection(@collection).merge(
          items: items.map { |item| serialize_item(item) }
        )
      end

      def create
        collection = current_user.collections.build(collection_params)
        collection.save!
        render json: serialize_collection(collection), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @collection.update!(collection_params)
        render json: serialize_collection(@collection)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @collection.destroy!
        head :no_content
      end

      # POST /api/v1/collections/:id/items { item_id }
      def add_item
        item = current_user.items.find(params[:item_id])
        @collection.collection_items.find_or_create_by!(item: item)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/collections/:id/items/:item_id
      def remove_item
        collection_item = @collection.collection_items.find_by(item_id: params[:item_id])
        collection_item&.destroy!
        head :no_content
      end

      private

      def set_collection
        @collection = current_user.collections.find(params[:id])
      end

      def collection_params
        params.require(:collection).permit(:name, :description)
      end

      def serialize_collection(collection)
        {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          item_count: collection_item_count(collection),
          created_at: collection.created_at
        }
      end

      # index では SELECT COUNT で item_count を取得済み。それ以外は関連件数を数える
      def collection_item_count(collection)
        if collection.has_attribute?(:item_count)
          collection.item_count
        else
          collection.collection_items.size
        end
      end
    end
  end
end
