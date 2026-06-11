module Api
  module V1
    class CollectionsController < BaseController
      include ItemSerialization

      before_action :set_collection, only: [ :show, :update, :destroy, :add_deck, :remove_deck ]

      def index
        collections = current_user.collections
                                  .recent
                                  .left_joins(:collection_decks)
                                  .select("collections.*, COUNT(collection_decks.id) AS deck_count")
                                  .group("collections.id")

        render json: { collections: collections.map { |c| serialize_collection(c) } }
      end

      def show
        decks = @collection.decks
                           .includes(deck_items: { item: { medias: { file_attachment: :blob } } })
                           .order("collection_decks.created_at DESC")

        render json: serialize_collection(@collection).merge(
          decks: decks.map { |deck| serialize_deck(deck) }
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

      # POST /api/v1/collections/:id/decks { deck_id }
      def add_deck
        deck = current_user.decks.find(params[:deck_id])
        @collection.collection_decks.find_or_create_by!(deck: deck)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/collections/:id/decks/:deck_id
      def remove_deck
        @collection.collection_decks.find_by(deck_id: params[:deck_id])&.destroy!
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
          deck_count: collection_deck_count(collection),
          created_at: collection.created_at
        }
      end

      # index では SELECT COUNT で deck_count を取得済み。それ以外は関連件数を数える
      def collection_deck_count(collection)
        if collection.has_attribute?(:deck_count)
          collection.deck_count
        else
          collection.collection_decks.size
        end
      end

      def serialize_deck(deck)
        {
          id: deck.id,
          name: deck.name,
          item_count: deck.deck_items.size,
          cover: serialize_media(deck.cover&.primary_media)
        }
      end
    end
  end
end
