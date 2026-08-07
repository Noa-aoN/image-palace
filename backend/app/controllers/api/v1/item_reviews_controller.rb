module Api
  module V1
    # カードを確認した記録の受け口。
    #
    # 1問ずつ送らず、**1回の学習ぶんをまとめて**受ける。20問のクイズで20回
    # 往復すると、通信のたびに詰まるし、途中で切れたとき何が残ったか分からない。
    #
    # 記録は「起きたこと」なので、あとから直せる必要はない。作るだけにする。
    class ItemReviewsController < BaseController
      MAX_PER_REQUEST = 200

      def create
        entries = build_entries
        return render(json: { error: "記録する内容がありません" }, status: :unprocessable_entity) if entries.empty?

        ItemReview.insert_all!(entries)
        render json: { recorded: entries.size }, status: :created
      end

      # そのカードの集計。詳細画面の「学習の記録」に出す。
      # 一覧の応答へ混ぜないのは、カードの枚数ぶん数え直すことになるため。
      def summary
        # member ルート配下なので :id で来る
        item = current_user.items.find(params[:id])
        render json: ItemReview.summarize(item.item_reviews)
      end

      private

      # 自分のカードのぶんだけ残す。知らない id が混ざっていても落とさず捨てる
      # （学習の途中でカードが消えることはある。そこで記録ごと失敗させない）。
      def build_entries
        # 形の違うもの（空配列が空文字で届く等）が混ざっても落とさない
        rows = Array(params[:reviews])
               .select { |r| r.is_a?(ActionController::Parameters) || r.is_a?(Hash) }
               .first(MAX_PER_REQUEST)
        item_ids = current_user.items.where(id: rows.map { |r| r[:item_id] }.compact).pluck(:id).to_set
        now = Time.current

        rows.filter_map do |row|
          item_id = row[:item_id].to_s
          next unless item_ids.include?(item_id)

          result = row[:result].to_s
          mode = row[:mode].to_s
          next unless ItemReview::RESULTS.include?(result) && ItemReview::MODES.include?(mode)

          {
            user_id: current_user.id, item_id: item_id, result: result, mode: mode,
            reviewed_at: now, created_at: now, updated_at: now
          }
        end
      end
    end
  end
end
