module Api
  module V1
    # ボードのカード間接続線（edges）の CRUD。
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

      # 重なり順の並び替え（ordered_edge_ids は手前→奥。先頭ほど大きい z_index）
      def reorder
        ids = Array(params[:ordered_edge_ids])
        ViewEdge.transaction do
          ids.each_with_index do |edge_id, index|
            @view.view_edges.where(id: edge_id).update_all(z_index: ids.size - index, updated_at: Time.current)
          end
        end
        head :no_content
      end

      private

      def set_view
        @view = current_user.views.find(params[:id])
      end

      def edge_params
        params.permit(
          :source_node_id, :target_node_id, :source_handle, :target_handle, :label, :z_index,
          # 画面が送るものは、ここに全部載せる。
          # 載っていないと strong parameters が黙って落とすので、
          # 「変えたのに次に開くと戻っている」ことになる
          # （線の種類・角の丸めがそうだった）
          style: [ :color, :dashed, :width, :opacity, :marker_start, :marker_end,
                   :label_color, :label_size, :label_bg, :label_opacity, :label_vertical,
                   :line_style, :curve, :curve_radius,
                   # AI が付ける関係の種類と強さ。あとから見直すための控え
                   :relation, :strength,
                   # 線の引き方。**落とすと画面が別の形を描く**
                   # （辺の中心から出てしまい、散らしたポートが根元で1点に戻る）
                   :source_port, :target_port, :label_t ],
          points: [ :x, :y ]
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
          style: edge.style,
          points: edge.points,
          z_index: edge.z_index
        }
      end
    end
  end
end
