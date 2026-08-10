module Api
  module V1
    module Admin
      # 運営ダッシュボードの数字。
      class OverviewsController < BaseController
        # days で期間を切り替える（7 / 30 / 90）。知らない値は既定に丸める
        def show
          render json: ::Admin::OverviewService.call(days: params[:days].to_i)
        end
      end
    end
  end
end
