module Api
  module V1
    # ライブラリ横断検索: カード/デッキ/コレクション/スペース/ビューをまとめて検索する
    class SearchController < BaseController
      include ItemSerialization

      LIMIT = 8

      def index
        q = params[:q].to_s.strip
        render json: q.blank? ? empty_result : search(q)
      end

      private

      def empty_result
        { items: [], decks: [], collections: [], spaces: [], views: [] }
      end

      def search(query)
        like = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"

        {
          items: current_user.items
                              .where("items.title ILIKE ?", like)
                              .order(created_at: :desc).limit(LIMIT)
                              .includes(:item_type, medias: { file_attachment: :blob })
                              .map { |i| serialize_item(i) },
          decks: current_user.decks
                             .where("name ILIKE ?", like)
                             .order(created_at: :desc).limit(LIMIT)
                             .map { |d| serialize_deck(d) },
          collections: current_user.collections
                                   .where("name ILIKE ?", like)
                                   .order(created_at: :desc).limit(LIMIT)
                                   .map { |c| serialize_collection(c) },
          spaces: current_user.spaces
                              .where("name ILIKE ?", like)
                              .order(created_at: :desc).limit(LIMIT)
                              .map { |s| { id: s.id, name: s.name } },
          views: current_user.views
                             .where("name ILIKE ?", like)
                             .order(created_at: :desc).limit(LIMIT)
                             .map { |v| { id: v.id, name: v.name } }
        }
      end

      def serialize_deck(deck)
        {
          id: deck.id,
          name: deck.name,
          item_count: deck.deck_items.size,
          cover: serialize_media(deck.cover&.primary_media)
        }
      end

      def serialize_collection(collection)
        { id: collection.id, name: collection.name, entry_count: collection.collection_entries.size }
      end
    end
  end
end
