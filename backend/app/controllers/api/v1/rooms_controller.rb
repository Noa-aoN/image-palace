module Api
  module V1
    class RoomsController < BaseController
      before_action :set_space
      before_action :set_room, only: [ :show, :update, :destroy, :add_collection, :remove_collection ]

      def index
        rooms = @space.rooms.ordered
        render json: { rooms: rooms.map { |r| serialize_room(r) } }
      end

      def show
        collections = @room.collections.recent
        render json: serialize_room(@room).merge(
          collections: collections.map { |c| serialize_collection(c) }
        )
      end

      def create
        room = @space.rooms.build(room_params)
        room.save!
        render json: serialize_room(room), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @room.update!(room_params)
        render json: serialize_room(@room)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @room.destroy!
        head :no_content
      end

      # POST /api/v1/spaces/:space_id/rooms/:id/collections { collection_id }
      def add_collection
        collection = current_user.collections.find(params[:collection_id])
        @room.room_collections.find_or_create_by!(collection: collection)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/spaces/:space_id/rooms/:id/collections/:collection_id
      def remove_collection
        room_collection = @room.room_collections.find_by(collection_id: params[:collection_id])
        room_collection&.destroy!
        head :no_content
      end

      private

      def set_space
        @space = current_user.spaces.find(params[:space_id])
      end

      def set_room
        @room = @space.rooms.find(params[:id])
      end

      def room_params
        params.require(:room).permit(:name, :layout_type)
      end

      def serialize_room(room)
        {
          id: room.id,
          space_id: room.space_id,
          name: room.name,
          layout_type: room.layout_type,
          collection_count: room.room_collections.size,
          created_at: room.created_at
        }
      end

      def serialize_collection(collection)
        {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          item_count: collection.collection_items.size
        }
      end
    end
  end
end
