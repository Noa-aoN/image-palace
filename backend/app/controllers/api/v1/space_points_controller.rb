module Api
  module V1
    # スペースのポイント（loci の点）。序数＋ポイント名を持ち、名前から画像を生成する。
    # road は序数順、room は間取り（x/y）で配置する想定。カードの割当も保持する（暫定）。
    class SpacePointsController < BaseController
      include ItemSerialization

      before_action :set_space
      before_action :set_point, only: [ :update, :destroy ]

      # 末尾にポイントを追加。name があればそのポイントの画像生成を開始する。
      def create
        name = stripped_name
        return render_limit_exceeded if name.present? && monthly_limit_reached?

        point = @space.space_points.create!(position: next_position, name: name)
        enqueue_generation(point) if point.name.present?
        render json: serialize_point(point), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # カードの割当/クリア（item_id）・序数の変更（position）・ポイント名の変更（name）。
      # 名前が新たに付く/変わると画像を（再）生成する。
      def update
        assign_item if params.key?(:item_id)
        @point.position = params[:position] if params.key?(:position)

        will_generate = name_will_generate?
        return render_limit_exceeded if will_generate && monthly_limit_reached?

        @point.name = stripped_name if params.key?(:name)
        @point.generation_status = "pending" if will_generate
        @point.save!
        enqueue_generation(@point) if will_generate
        render json: serialize_point(@point.reload)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @point.destroy!
        head :no_content
      end

      # 並び替え: ordered_ids の順に position を 1..N で振り直す
      def reorder
        ids = Array(params[:ordered_ids])
        SpacePoint.transaction do
          ids.each_with_index do |id, index|
            @space.space_points.where(id: id).update_all(position: index + 1, updated_at: Time.current)
          end
        end
        head :no_content
      end

      private

      def set_space
        @space = current_user.spaces.find(params[:space_id])
      end

      def set_point
        @point = @space.space_points.find(params[:id])
      end

      def assign_item
        item_id = params[:item_id]
        @point.item = item_id.present? ? current_user.items.find(item_id) : nil
      end

      def stripped_name
        params[:name].to_s.strip if params.key?(:name)
      end

      # 「生成」ボタン押下時に画像生成を走らせるか。
      # 名前があり、かつ「名前が変わった」または「前回失敗からの再試行」のとき生成する。
      # 同じ名前で生成済み（completed）の場合は再生成しない（同一プロンプトはキャッシュで同結果）。
      def name_will_generate?
        return false unless params.key?(:name)

        name = stripped_name
        return false if name.blank?

        name != @point.name || @point.generation_status == "failed"
      end

      def next_position
        (@space.space_points.maximum(:position) || 0) + 1
      end

      def enqueue_generation(point)
        GeneratePointImageJob.perform_later(point.id)
      end

      # カード＋名前付きポイントの合算が月間上限に達しているか
      def monthly_limit_reached?
        current_user.monthly_generation_count >= Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH
      end

      def render_limit_exceeded
        render json: {
          error: "今月の生成枚数の上限（#{Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH}枚）に達しました"
        }, status: :unprocessable_entity
      end
    end
  end
end
