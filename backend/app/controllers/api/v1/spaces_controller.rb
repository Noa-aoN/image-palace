module Api
  module V1
    class SpacesController < BaseController
      include ItemSerialization

      before_action :set_space, only: [ :show, :update, :destroy, :add_collection, :remove_collection ]

      def index
        spaces = current_user.spaces.recent
        render json: { spaces: spaces.map { |s| serialize_space(s) } }
      end

      def show
        render json: serialize_space_detail(@space)
      end

      def create
        space = current_user.spaces.build(space_params)
        space.save!
        render json: serialize_space(space), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @space.update!(space_params)
        render json: serialize_space(@space)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @space.destroy!
        head :no_content
      end

      # room 種別: コレクションを並べる
      def add_collection
        collection = current_user.collections.find(params[:collection_id])
        @space.space_collections.find_or_create_by!(collection: collection)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def remove_collection
        @space.space_collections.find_by(collection_id: params[:collection_id])&.destroy!
        head :no_content
      end

      private

      def set_space
        @space = current_user.spaces.find(params[:id])
      end

      def space_params
        params.require(:space).permit(:name, :description, :space_type)
      end

      def serialize_space(space)
        {
          id: space.id,
          name: space.name,
          description: space.description,
          space_type: space.space_type,
          created_at: space.created_at
        }
      end

      def serialize_space_detail(space)
        base = serialize_space(space)
        if space.space_type == "road"
          points = space.space_points.ordered.includes(
            { item: [ :item_type, { medias: { file_attachment: :blob } } ] },
            { image_attachment: :blob }
          )
          base.merge(points: points.map { |p| serialize_point(p) })
        else
          collections = space.collections.recent
          base.merge(collections: collections.map { |c| serialize_collection(c) })
        end
      end

      def serialize_collection(collection)
        {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          entry_count: collection.collection_entries.size
        }
      end
    end
  end
end
