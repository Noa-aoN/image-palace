module Api
  module V1
    module Billing
      # 料金ページ用に有効なプラン一覧を返す。
      class PlansController < Api::V1::BaseController
        def index
          plans = Plan.active.order(:price_cents)
          render json: { plans: plans.map { |plan| serialize(plan) } }
        end

        private

        # 獲得物の絵と同じ配信元。手元に CDN の設定が無くても見えるようにする
        def image_base
          ENV["CDN_BASE_URL"].presence || Achievements::Presenter::PUBLIC_IMAGE_BASE
        end

        def serialize(plan)
          {
            name: plan.name,
            tier: plan.tier,
            kind: plan.kind,
            interval: plan.interval,
            price: plan.price_cents,
            currency: plan.currency,
            credits: plan.credits_per_period,
            # 徽章。獲得物と同じく鍵だけを持ち、環境ごとには作り直さない
            image_url: plan.image_key.presence && "#{image_base}/#{plan.image_key}"
          }
        end
      end
    end
  end
end
