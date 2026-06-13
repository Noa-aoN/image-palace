module Api
  module V1
    # スペース内のロード（連結法/ジャーニー）。序数のあるポイント列を持つ。
    class RoadsController < BaseController
      include ItemSerialization

      before_action :set_space
      before_action :set_road, only: [ :show, :update, :destroy ]

      def index
        roads = @space.roads.ordered
        render json: { roads: roads.map { |r| serialize_road(r) } }
      end

      def show
        render json: serialize_road_detail(@road)
      end

      def create
        road = @space.roads.build(road_params)
        road.save!
        render json: serialize_road(road), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @road.update!(road_params)
        render json: serialize_road(@road)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @road.destroy!
        head :no_content
      end

      private

      def set_space
        @space = current_user.spaces.find(params[:space_id])
      end

      def set_road
        @road = @space.roads.find(params[:id])
      end

      def road_params
        params.require(:road).permit(:name, :position)
      end

      def serialize_road(road)
        {
          id: road.id,
          space_id: road.space_id,
          name: road.name,
          position: road.position,
          point_count: road.road_points.size,
          created_at: road.created_at
        }
      end

      def serialize_road_detail(road)
        points = road.road_points.ordered.includes(item: [ :item_type, { medias: { file_attachment: :blob } } ])
        serialize_road(road).merge(points: points.map { |p| serialize_point(p) })
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
