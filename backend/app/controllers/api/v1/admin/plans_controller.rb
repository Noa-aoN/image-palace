module Api
  module V1
    module Admin
      # プラン（ユーザー種類）ごとの付与クレジットの確認と設定。
      #
      # 変えられるのは付与量と有効/無効だけにしてある。価格は Stripe の Price を
      # 作り直すことになり既存の契約者にも影響が及ぶため、ここからは触らせない
      # （Billing::Catalog の方針に合わせている）。
      class PlansController < BaseController
        # プランは stripe_price_id を含む＝課金の根幹。最上位だけが触れる
        before_action -> { require_role!(:admin) }, only: [ :update ]
        def index
          render json: {
            plans: Plan.order(:price_cents).map { |plan| serialize(plan) },
            min_margin: ::Billing::Catalog::MIN_MARGIN,
            cost_per_credit: ::Billing::Catalog::COST_PER_CREDIT,
            stripe_fee_rate: ::Billing::Catalog::STRIPE_FEE_RATE
          }
        end

        def update
          plan = Plan.find(params[:id])
          before = plan.slice(:credits_per_period, :active)
          plan.assign_attributes(plan_params)

          if (error = margin_violation(plan))
            return render json: { errors: [ error ] }, status: :unprocessable_entity
          end

          if plan.save
            audit!("plan_update", target: plan, details: { before: before, after: plan.slice(:credits_per_period, :active) })
            render json: { plan: serialize(plan) }
          else
            render json: { errors: plan.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def plan_params
          params.require(:plan).permit(:credits_per_period, :active)
        end

        # 付与を増やしすぎると原価割れする。定数とテストで守ってきた不変条件を、
        # 画面から変えられるようにした以上はサーバー側でも確かめる
        def margin_violation(plan)
          return nil if plan.price_cents.to_i.zero?
          return nil if plan.credits_per_period.to_i.zero?

          margin = ::Billing::Catalog.margin({ price: plan.price_cents, credits: plan.credits_per_period })
          return nil if margin >= ::Billing::Catalog::MIN_MARGIN

          "付与を #{plan.credits_per_period} にすると粗利率が #{(margin * 100).round(1)}% になり、" \
            "下限 #{(::Billing::Catalog::MIN_MARGIN * 100).round}% を下回ります"
        end

        def serialize(plan)
          {
            id: plan.id,
            name: plan.name,
            tier: plan.tier,
            kind: plan.kind,
            price: plan.price_cents,
            credits_per_period: plan.credits_per_period,
            active: plan.active,
            margin: plan.price_cents.to_i.positive? && plan.credits_per_period.to_i.positive? ?
                      (::Billing::Catalog.margin({ price: plan.price_cents, credits: plan.credits_per_period }) * 100).round(1) : nil,
            # Stripe と紐付いているものは価格の変更に作り直しが要る
            stripe_linked: plan.stripe_price_id.present?
          }
        end
      end
    end
  end
end
