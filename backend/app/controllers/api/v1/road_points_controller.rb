module Api
  module V1
    # ロードのポイント（序数のある点）。空ポイント作成 → 既存カードを割当。
    class RoadPointsController < BaseController
      include ItemSerialization

      before_action :set_road
      before_action :set_point, only: [ :update, :destroy ]

      # 末尾に空ポイントを追加する
      def create
        max = @road.road_points.maximum(:position) || 0
        point = @road.road_points.create!(position: max + 1)
        render json: serialize_point(point), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # カードの割当/クリア（item_id）・序数の変更（position）
      def update
        assign_item if params.key?(:item_id)
        @point.position = params[:position] if params.key?(:position)
        @point.save!
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
        RoadPoint.transaction do
          ids.each_with_index do |id, index|
            @road.road_points.where(id: id).update_all(position: index + 1, updated_at: Time.current)
          end
        end
        head :no_content
      end

      private

      def set_road
        space = current_user.spaces.find(params[:space_id])
        @road = space.roads.find(params[:road_id])
      end

      def set_point
        @point = @road.road_points.find(params[:id])
      end

      # item_id が空ならクリア、指定があれば所有カードを割り当てる
      def assign_item
        item_id = params[:item_id]
        @point.item = item_id.present? ? current_user.items.find(item_id) : nil
      end

      def serialize_point(point)
        {
          id: point.id,
          position: point.position,
          item: point.item ? serialize_item(point.item) : nil
        }
      end
    end
  end
end
