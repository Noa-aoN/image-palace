module Api
  module V1
    class ViewsController < BaseController
      include ItemSerialization

      before_action :set_view, only: [
        :show, :update, :destroy, :add_item, :update_item, :remove_item, :place_on_point, :clear_point
      ]

      def index
        views = current_user.views.recent
        render json: { views: views.map { |v| serialize_view(v) } }
      end

      def show
        render json: serialize_view_detail(@view)
      end

      def create
        view = current_user.views.build(view_params)
        view.save!
        render json: serialize_view(view), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @view.update!(view_params)
        render json: serialize_view(@view)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @view.destroy!
        head :no_content
      end

      # フリーボードにカードを配置する
      def add_item
        item = current_user.items.find(params[:item_id])
        view_item = @view.view_items.find_or_initialize_by(item_id: item.id)
        view_item.assign_attributes(placement_params)
        view_item.save!
        render json: serialize_placement(view_item.tap { |vi| vi.item = item }), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # 配置（座標・重なり順）を更新する
      def update_item
        view_item = @view.view_items.find_by!(item_id: params[:item_id])
        view_item.update!(placement_params)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # フリーボードからカードを外す
      def remove_item
        @view.view_items.find_by(item_id: params[:item_id])&.destroy!
        head :no_content
      end

      # space_map: スペースのポイントにカードを配置する。
      # 1 ポイント 1 カード（差し替え可）。同じカードは複数ポイントに置ける（再利用可）。
      def place_on_point
        point = view_space_point!
        item = current_user.items.find(params[:item_id])

        placement = @view.view_items.find_or_initialize_by(space_point_id: point.id)
        placement.item = item
        placement.save!
        render json: serialize_point_placement(point, placement), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # space_map: ポイントからカードを外す
      def clear_point
        @view.view_items.find_by(space_point_id: params[:space_point_id])&.destroy!
        head :no_content
      end

      private

      def set_view
        @view = current_user.views.find(params[:id])
      end

      # 配置先ポイントがこのビューのスペースに属することを保証する
      def view_space_point!
        raise ActiveRecord::RecordNotFound unless @view.space
        @view.space.space_points.find(params[:space_point_id])
      end

      def view_params
        params.require(:view).permit(:name, :view_type, :space_id)
      end

      def placement_params
        params.permit(:x, :y, :z_index)
      end

      def serialize_view(view)
        {
          id: view.id,
          name: view.name,
          view_type: view.view_type,
          space_id: view.space_id,
          created_at: view.created_at
        }
      end

      def serialize_view_detail(view)
        return serialize_space_map_detail(view) if view.space_map?

        placements = view.view_items
                         .includes(item: [ :item_type, { medias: { file_attachment: :blob } } ])
                         .order(:z_index, :created_at)
        serialize_view(view).merge(items: placements.map { |vi| serialize_placement(vi) })
      end

      # space_map: スペースのポイント一覧（序数＋名前＋ポイント画像）と、各ポイントへの配置カードを返す
      def serialize_space_map_detail(view)
        base = serialize_view(view)
        space = view.space
        return base.merge(space: nil, points: []) unless space

        points = space.space_points.ordered.includes(image_attachment: :blob)
        placed = view.view_items
                     .where.not(space_point_id: nil)
                     .includes(item: [ :item_type, { medias: { file_attachment: :blob } } ])
                     .index_by(&:space_point_id)

        base.merge(
          space: { id: space.id, name: space.name, space_type: space.space_type },
          points: points.map { |point| serialize_point_placement(point, placed[point.id]) }
        )
      end

      # ポイントの loci 情報 + そのポイントに配置されたカード
      def serialize_point_placement(point, view_item)
        {
          space_point_id: point.id,
          position: point.position,
          name: point.name,
          generation_status: point.generation_status,
          image: serialize_point_image(point),
          placed_item: view_item&.item ? serialize_item(view_item.item) : nil
        }
      end

      def serialize_placement(view_item)
        {
          item_id: view_item.item_id,
          x: view_item.x,
          y: view_item.y,
          z_index: view_item.z_index,
          item: serialize_item(view_item.item)
        }
      end
    end
  end
end
