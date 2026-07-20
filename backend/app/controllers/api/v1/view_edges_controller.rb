module Api
  module V1
    # フリーボードのカード間接続線（edges）の CRUD。
    class ViewEdgesController < BaseController
      before_action :set_view

      def create
        edge = @view.view_edges.new(edge_params)
        edge.save!
        render json: serialize_edge(edge), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        edge = @view.view_edges.find(params[:edge_id])
        edge.update!(edge_params)
        render json: serialize_edge(edge)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @view.view_edges.find_by(id: params[:edge_id])&.destroy!
        head :no_content
      end

      private

      def set_view
        @view = current_user.views.find(params[:id])
      end

      def edge_params
        params.permit(
          :source_node_id, :target_node_id, :source_handle, :target_handle, :label,
          style: [ :color, :dashed, :width, :opacity, :label_color, :label_size, :label_bg, :label_opacity ]
        )
      end

      def serialize_edge(edge)
        {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          source_handle: edge.source_handle,
          target_handle: edge.target_handle,
          label: edge.label,
          style: edge.style
        }
      end
    end
  end
end
