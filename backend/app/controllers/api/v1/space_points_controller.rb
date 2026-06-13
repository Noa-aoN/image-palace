module Api
  module V1
    # road 種別スペースのポイント（序数の点）。空ポイント作成 → 既存カードを割当。
    class SpacePointsController < BaseController
      include ItemSerialization

      before_action :set_space
      before_action :set_point, only: [ :update, :destroy ]

      # 末尾に空ポイントを追加
      def create
        max = @space.space_points.maximum(:position) || 0
        point = @space.space_points.create!(position: max + 1)
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
