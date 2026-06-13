module Api
  module V1
    class ViewsController < BaseController
      include ItemSerialization

      before_action :set_view, only: [ :show, :update, :destroy, :add_item, :update_item, :remove_item ]

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

      private

      def set_view
        @view = current_user.views.find(params[:id])
      end

      def view_params
        params.require(:view).permit(:name, :view_type)
      end

      def placement_params
        params.permit(:x, :y, :z_index)
      end

      def serialize_view(view)
        {
          id: view.id,
          name: view.name,
          view_type: view.view_type,
          created_at: view.created_at
        }
      end

      def serialize_view_detail(view)
        placements = view.view_items
                         .includes(item: [ :item_type, { medias: { file_attachment: :blob } } ])
                         .order(:z_index, :created_at)
        serialize_view(view).merge(items: placements.map { |vi| serialize_placement(vi) })
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
