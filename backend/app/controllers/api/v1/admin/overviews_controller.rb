module Api
  module V1
    module Admin
      # 運営ダッシュボードの数字。
      class OverviewsController < BaseController
        def show
          render json: ::Admin::OverviewService.call
        end
      end
    end
  end
end
