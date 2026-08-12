module Api
  module V1
    module Admin
      # 経営の数字（Business Analytics）。
      #
      # 認可は Admin::BaseController が持つ（運営判定 + 強い確認）。
      # ここは読むだけなので、書き込みの role 制限は付けない。
      class BusinessMetricsController < BaseController
        # period で期間を切り替える（7d / 30d / 90d / 6m / 1y / all / 2026-07）。
        # 知らない値は既定（直近30日）に丸める
        def show
          render json: ::Admin::BusinessMetricsService.call(period: params[:period])
        end
      end
    end
  end
end
