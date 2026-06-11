module Api
  module V1
    class ViewsController < BaseController
      before_action :set_view, only: [ :show, :update, :destroy ]

      def index
        views = current_user.views.recent
        render json: { views: views.map { |v| serialize_view(v) } }
      end

      def show
        render json: serialize_view(@view)
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

      private

      def set_view
        @view = current_user.views.find(params[:id])
      end

      def view_params
        params.require(:view).permit(:name, :view_type)
      end

      def serialize_view(view)
        {
          id: view.id,
          name: view.name,
          view_type: view.view_type,
          created_at: view.created_at
        }
      end
    end
  end
end
