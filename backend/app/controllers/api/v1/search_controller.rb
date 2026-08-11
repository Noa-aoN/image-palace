module Api
  module V1
    # ライブラリ横断検索: カード/デッキ/コレクション/スペース/キャンバスをまとめて検索する
    class SearchController < BaseController
      include ItemSerialization

      LIMIT = 8

      def index
        q = params[:q].to_s.strip
        render json: q.blank? ? empty_result : search(q)
      end

      private

      def empty_result
        { items: [], decks: [], boxes: [], spaces: [], views: [] }
      end

      def search(query)
        like = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"

        {
          items: current_user.items
                              .where("items.title ILIKE ?", like)
                              .order(created_at: :desc).limit(LIMIT)
                              .includes(:item_type, MEDIA_INCLUDES)
                              .map { |i| serialize_item(i) },
          # デッキは view_type='deck' のキャンバスへ統合済み
          decks: current_user.views.where(view_type: "deck")
                             .where("name ILIKE ?", like)
                             .order(created_at: :desc).limit(LIMIT)
                             .includes(view_items: { item: MEDIA_INCLUDES })
                             .map { |v| serialize_deck_view(v) },
          boxes: current_user.boxes
                                   .where("name ILIKE ?", like)
                                   .order(created_at: :desc).limit(LIMIT)
                                   .includes(:box_entries)
                                   .map { |c| serialize_box(c) },
          spaces: current_user.spaces
                              .where("name ILIKE ?", like)
                              .order(created_at: :desc).limit(LIMIT)
                              .map { |s| { id: s.id, name: s.name } },
          # deck は decks グループで返すため、views グループからは除外
          views: current_user.views.where.not(view_type: "deck")
                             .where("name ILIKE ?", like)
                             .order(created_at: :desc).limit(LIMIT)
                             .map { |v| { id: v.id, name: v.name } }
        }
      end

      def serialize_deck_view(view)
        {
          id: view.id,
          name: view.name,
          item_count: view.view_items.size,
          cover: serialize_media(view.cover&.primary_media)
        }
      end

      def serialize_box(box)
        { id: box.id, name: box.name, entry_count: box.box_entries.size }
      end
    end
  end
end
