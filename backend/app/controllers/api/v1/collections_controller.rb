module Api
  module V1
    class CollectionsController < BaseController
      include ItemSerialization

      before_action :set_collection, only: [ :show, :update, :destroy, :add_entry, :remove_entry ]

      def index
        collections = current_user.collections
                                  .recent
                                  .left_joins(:collection_entries)
                                  .select("collections.*, COUNT(collection_entries.id) AS entry_count")
                                  .group("collections.id")

        render json: { collections: collections.map { |c| serialize_collection(c) } }
      end

      def show
        entries = @collection.collection_entries.includes(:entry).order(created_at: :desc)

        render json: serialize_collection(@collection).merge(
          entries: entries.filter_map { |e| serialize_entry(e) }
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

      # POST /api/v1/collections/:id/entries { entry_type, entry_id }
      # entry_type は Item / Deck / Space / View
      def add_entry
        entry = find_owned_entry(params[:entry_type], params[:entry_id])
        @collection.collection_entries.find_or_create_by!(entry_type: params[:entry_type], entry_id: entry.id)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/collections/:id/entries/:entry_type/:entry_id
      def remove_entry
        @collection.collection_entries
                   .find_by(entry_type: params[:entry_type], entry_id: params[:entry_id])&.destroy!
        head :no_content
      end

      private

      def set_collection
        @collection = current_user.collections.find(params[:id])
      end

      def collection_params
        params.require(:collection).permit(:name, :description)
      end

      # entry_type に応じて current_user 所有のオブジェクトを引く（他人のものは 404）
      def find_owned_entry(entry_type, entry_id)
        scope =
          case entry_type
          when "Item" then current_user.items
          when "Deck" then current_user.decks
          when "Space" then current_user.spaces
          when "View" then current_user.views
          else raise ActiveRecord::RecordNotFound
          end
        scope.find(entry_id)
      end

      def serialize_collection(collection)
        {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          entry_count: collection_entry_count(collection),
          created_at: collection.created_at
        }
      end

      def collection_entry_count(collection)
        if collection.has_attribute?(:entry_count)
          collection.entry_count
        else
          collection.collection_entries.size
        end
      end

      def serialize_entry(collection_entry)
        obj = collection_entry.entry
        return nil if obj.nil?

        base = { entry_type: collection_entry.entry_type, id: obj.id }
        case collection_entry.entry_type
        when "Item"
          base.merge(title: obj.title, media: serialize_media(obj.primary_media))
        when "Deck"
          base.merge(name: obj.name, item_count: obj.deck_items.size, cover: serialize_media(obj.cover&.primary_media))
        when "Space", "View"
          base.merge(name: obj.name)
        end
      end
    end
  end
end
