module Api
  module V1
    class SpacesController < BaseController
      before_action :set_space, only: [ :show, :update, :destroy ]

      def index
        spaces = current_user.spaces.recent
        render json: { spaces: spaces.map { |s| serialize_space(s) } }
      end

      def show
        render json: serialize_space(@space)
      end

      def create
        space = current_user.spaces.build(space_params)
        space.save!
        render json: serialize_space(space), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @space.update!(space_params)
        render json: serialize_space(@space)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @space.destroy!
        head :no_content
      end

      private

      def set_space
        @space = current_user.spaces.find(params[:id])
      end

      def space_params
        params.require(:space).permit(:name, :description)
      end

      def serialize_space(space)
        {
          id: space.id,
          name: space.name,
          description: space.description,
          created_at: space.created_at
        }
      end
    end
  end
end
