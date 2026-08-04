module Api
  module V1
    module Billing
      # 現在のユーザーのクレジット残高・プラン・サブスク状態を返す（アカウント画面用）。
      class SummariesController < Api::V1::BaseController
        def show
          # webhook の取りこぼしを、利用者が気づく前にここで拾う。
          # 間隔を空けて確認するので、毎回 Stripe を叩くわけではない。
          #
          # 無料枠の付与より先に行う。契約したのに webhook がまだ来ていない状態で
          # 先に無料枠を判定すると、有料なのに無料扱いになってしまうため。
          if ::Billing::AutoReconciler.call(current_user)
            # 突き合わせで契約が増えている可能性があるので、読み直してから判定する
            current_user.reload
          end

          # 表示残高が当月の無料枠を反映するよう、参照時に lazy 付与しておく。
          current_user.ensure_current_period_credits!

          sub = current_user.active_subscription
          plan = sub&.plan || Plan.find_by(name: "free")

          # 次回更新（クレジット回復）日。有料はサブスク期末、無料は登録日アニバーサリーの翌周期。
          next_credit_reset = sub ? sub.current_period_end : current_user.next_free_credit_reset_at

          render json: {
            available_credits: current_user.available_credits,
            # 残高の内訳（クレジット単位）。bonus=期限付きグラント（最も近い期限も返す）。
            credit_breakdown: {
              grant: current_user.grant_credit_points.fdiv(::Billing::POINTS_PER_CREDIT),
              grant_expires_at: current_user.credit_grants.active.minimum(:expires_at),
              subscription: current_user.subscription_credits.fdiv(::Billing::POINTS_PER_CREDIT),
              topup: current_user.topup_credits.fdiv(::Billing::POINTS_PER_CREDIT)
            },
            # 期限ごとの内訳。どれがいつ消えるのかが見えないと、使い切る判断ができない
            credit_buckets: credit_buckets,
            plan: plan && { name: plan.name, tier: plan.tier, credits_per_period: plan.credits_per_period },
            subscription: sub && {
              status: sub.status,
              current_period_end: sub.current_period_end,
              cancel_at_period_end: sub.cancel_at_period_end
            },
            next_credit_reset: next_credit_reset
          }
        end

        private

        # 残高を「いつ消えるか」で並べて返す。期限が近い順＝使われる順。
        def credit_buckets
          buckets = current_user.credit_grants.active.map do |grant|
            {
              kind: grant.kind,
              label: ::Billing::CreditLabels.for(grant.kind),
              credits: to_credits(grant.remaining_points),
              expires_at: grant.expires_at
            }
          end

          if current_user.subscription_credits.positive?
            buckets << {
              kind: "subscription", label: ::Billing::CreditLabels.for("subscription"),
              credits: to_credits(current_user.subscription_credits),
              expires_at: current_user.subscription_expires_at
            }
          end

          if current_user.topup_credits.positive?
            # 期限を持たない古い買い切り分
            buckets << {
              kind: "topup_legacy", label: ::Billing::CreditLabels.for("topup_legacy"),
              credits: to_credits(current_user.topup_credits), expires_at: nil
            }
          end

          buckets.sort_by { |bucket| [ bucket[:expires_at] ? 0 : 1, bucket[:expires_at] || Time.current ] }
        end

        def to_credits(points)
          points.fdiv(::Billing::POINTS_PER_CREDIT).round(2)
        end
      end
    end
  end
end
