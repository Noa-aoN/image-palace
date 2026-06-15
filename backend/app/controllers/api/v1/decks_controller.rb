module Api
  module V1
    class DecksController < BaseController
      include ItemSerialization

      before_action :set_deck, only: [ :show, :update, :destroy, :add_item, :remove_item, :upload_cover, :remove_cover ]

      # カバー描画に必要なカード画像・cover_item・アップロード画像を N+1 なしで読む
      COVER_INCLUDES = [
        { cover_item: { medias: { file_attachment: :blob } } },
        { deck_items: { item: { medias: { file_attachment: :blob } } } },
        { cover_image_attachment: :blob }
      ].freeze

      def index
        decks = current_user.decks.recent.includes(*COVER_INCLUDES)
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

      # POST /api/v1/decks/:id/cover_image （multipart: cover_image）
      # custom カバー画像をアップロードし、表示モードを custom に切り替える
      def upload_cover
        file = params[:cover_image]
        return render(json: { errors: [ "画像が指定されていません" ] }, status: :unprocessable_entity) if file.blank?

        @deck.cover_image.attach(file)
        @deck.update!(cover_type: "custom")
        render json: serialize_deck(@deck)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/decks/:id/cover_image
      # custom カバー画像を削除し、表示モードを first_card に戻す
      def remove_cover
        @deck.cover_image.purge if @deck.cover_image.attached?
        @deck.update!(cover_type: "first_card")
        render json: serialize_deck(@deck)
      end

      private

      def set_deck
        @deck = current_user.decks.find(params[:id])
      end

      def deck_params
        params.require(:deck).permit(:name)
      end

      def deck_update_params
        params.require(:deck).permit(:name, :cover_item_id, :cover_type)
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
          cover_type: deck.cover_type,
          cover_item_id: deck.cover_item_id,
          cover: serialize_media(deck.cover&.primary_media),
          # first_card（先頭切替）/ collage 用のカード画像（順序付き、最大 COVER_CARDS_LIMIT 枚）
          cover_images: deck.cover_cards.map { |item| serialize_media(item.primary_media) }.compact,
          # custom モードのアップロード画像
          cover_image: serialize_cover_image(deck),
          created_at: deck.created_at
        }
      end

      def serialize_cover_image(deck)
        return nil unless deck.cover_image.attached?

        blob = deck.cover_image.blob
        return nil unless blob_available?(blob)

        { url: media_url(blob), thumb_url: thumbnail_url(blob) }
      end
    end
  end
end
