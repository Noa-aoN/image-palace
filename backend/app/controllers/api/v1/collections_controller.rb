module Api
  module V1
    class CollectionsController < BaseController
      include ItemSerialization
      include CoverImageUpload

      before_action :set_collection, only: [
        :show, :update, :destroy, :add_entry, :remove_entry, :upload_cover, :remove_cover
      ]

      def index
        collections = current_user.collections
                                  .recent
                                  .left_joins(:collection_entries)
                                  .select("collections.*, COUNT(collection_entries.id) AS entry_count")
                                  .group("collections.id")
                                  # cover/cover_cards が collection_entries→entry を走査するため preload して N+1 を防ぐ
                                  .includes(:cover_item, collection_entries: :entry)
                                  .with_attached_cover_image
                                  .with_attached_cover_thumb

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
        @collection.assign_attributes(collection_update_params)
        validate_cover!
        @collection.save!
        render json: serialize_collection(@collection)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @collection.destroy!
        head :no_content
      end

      # POST /api/v1/collections/:id/entries { entry_type, entry_id }
      # entry_type は Item / Space / View
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
        # 表紙にしていたカードを外した場合は表紙指定も解除する
        if params[:entry_type] == "Item" && @collection.cover_item_id == params[:entry_id]
          @collection.update!(cover_item_id: nil)
        end
        head :no_content
      end

      # POST /api/v1/collections/:id/cover_image （multipart: cover_image）
      def upload_cover
        file = params[:cover_image]
        return render(json: { errors: [ "画像が指定されていません" ] }, status: :unprocessable_entity) if file.blank?

        attach_optimized_cover!(@collection, file)
        @collection.update!(cover_type: "custom")
        render json: serialize_collection(@collection)
      rescue CoverImageUpload::InvalidCover => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/collections/:id/cover_image
      def remove_cover
        @collection.cover_image.purge if @collection.cover_image.attached?
        @collection.cover_thumb.purge if @collection.cover_thumb.attached?
        @collection.update!(cover_type: "first_card")
        render json: serialize_collection(@collection)
      end

      private

      def set_collection
        @collection = current_user.collections.find(params[:id])
      end

      def collection_params
        params.require(:collection).permit(:name, :description)
      end

      def collection_update_params
        params.require(:collection).permit(:name, :description, :cover_item_id, :cover_type)
      end

      # 表紙はコレクション内の Item エントリのみ指定可能
      def validate_cover!
        return if @collection.cover_item_id.blank?
        return if @collection.collection_entries.exists?(entry_type: "Item", entry_id: @collection.cover_item_id)

        @collection.errors.add(:cover_item_id, "はこのボックス内のカードを指定してください")
        raise ActiveRecord::RecordInvalid, @collection
      end

      # entry_type に応じて current_user 所有のオブジェクトを引く（他人のものは 404）
      def find_owned_entry(entry_type, entry_id)
        scope =
          case entry_type
          when "Item" then current_user.items
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
          cover_type: collection.cover_type,
          cover_item_id: collection.cover_item_id,
          cover: serialize_media(collection.cover&.primary_media),
          cover_images: collection.cover_cards.map { |item| serialize_media(item.primary_media) }.compact,
          cover_image: serialize_attached_cover(collection),
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
        when "Space"
          base.merge(name: obj.name, cover: obj.cover_point ? serialize_point_image(obj.cover_point) : nil)
        when "View"
          base.merge(name: obj.name, cover: serialize_media(obj.cover&.primary_media))
        end
      end
    end
  end
end
