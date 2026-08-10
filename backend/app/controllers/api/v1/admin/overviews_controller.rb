module Api
  module V1
    module Admin
      # 運営ダッシュボードの数字。
      class OverviewsController < BaseController
        # period で期間を切り替える（7d / 30d / 90d / 6m / 1y / all / 2026-07）。
        # 知らない値は既定（直近30日）に丸める
        def show
          render json: ::Admin::OverviewService.call(period: params[:period])
        end
      end
    end
  end
end
