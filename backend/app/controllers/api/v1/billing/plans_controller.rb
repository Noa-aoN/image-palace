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

        def serialize(plan)
          {
            name: plan.name,
            tier: plan.tier,
            kind: plan.kind,
            interval: plan.interval,
            price: plan.price_cents,
            currency: plan.currency,
            credits: plan.credits_per_period
          }
        end
      end
    end
  end
end
