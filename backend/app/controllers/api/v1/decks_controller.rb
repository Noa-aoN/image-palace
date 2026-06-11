module Api
  module V1
    class DecksController < BaseController
      include ItemSerialization

      before_action :set_deck, only: [ :show, :update, :destroy, :add_item, :remove_item ]

      def index
        decks = current_user.decks.recent
        render json: { decks: decks.map { |d| serialize_deck(d) } }
      end

      def show
        items = @deck.items
                     .includes(:item_type, medias: { file_attachment: :blob })
                     .order("deck_items.created_at DESC")

        render json: serialize_deck(@deck).merge(
          items: items.map { |item| serialize_item(item) }
        )
      end

      def create
        deck = current_user.decks.build(deck_params)
        deck.save!
        render json: serialize_deck(deck), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # 名前変更・表紙（cover_item_id）の設定
      def update
        @deck.assign_attributes(deck_update_params)
        validate_cover!
        @deck.save!
        render json: serialize_deck(@deck)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @deck.destroy!
        head :no_content
      end

      # POST /api/v1/decks/:id/items { item_id }
      def add_item
        item = current_user.items.find(params[:item_id])
        @deck.deck_items.find_or_create_by!(item: item)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/decks/:id/items/:item_id
      def remove_item
        @deck.deck_items.find_by(item_id: params[:item_id])&.destroy!
        # 表紙にしていたカードを外した場合は表紙指定も解除する
        @deck.update!(cover_item_id: nil) if @deck.cover_item_id == params[:item_id]
        head :no_content
      end

      private

      def set_deck
        @deck = current_user.decks.find(params[:id])
      end

      def deck_params
        params.require(:deck).permit(:name)
      end

      def deck_update_params
        params.require(:deck).permit(:name, :cover_item_id)
      end

      # 表紙はデッキ内のカードのみ指定可能
      def validate_cover!
        return if @deck.cover_item_id.blank?
        return if @deck.deck_items.exists?(item_id: @deck.cover_item_id)

        @deck.errors.add(:cover_item_id, "はこのデッキ内のカードを指定してください")
        raise ActiveRecord::RecordInvalid, @deck
      end

      def serialize_deck(deck)
        {
          id: deck.id,
          name: deck.name,
          item_count: deck.deck_items.size,
          cover_item_id: deck.cover_item_id,
          cover: serialize_media(deck.cover&.primary_media),
          created_at: deck.created_at
        }
      end
    end
  end
end
