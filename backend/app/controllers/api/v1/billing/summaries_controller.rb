module Api
  module V1
    module Billing
      # 現在のユーザーのクレジット残高・プラン・サブスク状態を返す（アカウント画面用）。
      class SummariesController < Api::V1::BaseController
        def show
          # 表示残高が当月の無料枠を反映するよう、参照時に lazy 付与しておく。
          current_user.ensure_current_period_credits!

          sub = current_user.active_subscription
          plan = sub&.plan || Plan.find_by(name: "free")

          # 次回更新（クレジット回復）日。有料はサブスクの期末、無料はカレンダー月の翌月初。
          next_credit_reset =
            if sub
              sub.current_period_end
            else
              (current_user.credits_period_start || Time.current.beginning_of_month).next_month.beginning_of_month
            end

          render json: {
            available_credits: current_user.available_credits,
            plan: plan && { name: plan.name, tier: plan.tier, credits_per_period: plan.credits_per_period },
            subscription: sub && {
              status: sub.status,
              current_period_end: sub.current_period_end,
              cancel_at_period_end: sub.cancel_at_period_end
            },
            next_credit_reset: next_credit_reset
          }
        end
      end
    end
  end
end
