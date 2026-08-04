# frozen_string_literal: true

module Billing
  # DB の Plan 定義から Stripe の Products/Prices を作成し、stripe_product_id /
  # stripe_price_id を埋め戻す。テストキー/本番キーで生成される ID が異なるため、
  # 環境ごとに（その環境の STRIPE_SECRET_KEY で）実行する。
  # 既に ID が入っているものはスキップする（冪等）。free プランは Stripe 不要。
  class SyncPlans
    class MissingApiKey < StandardError; end

    Result = Struct.new(:created_products, :created_prices, keyword_init: true)

    def self.call(...)
      new(...).call
    end

    def initialize(logger: nil)
      @logger = logger
    end

    def call
      raise MissingApiKey, "STRIPE_SECRET_KEY が未設定です" if Stripe.api_key.blank?

      created_products = 0
      created_prices = 0

      target_plans.find_each do |plan|
        if plan.stripe_product_id.blank?
          product = Stripe::Product.create(product_params(plan))
          plan.update!(stripe_product_id: product.id)
          created_products += 1
          log("product #{plan.name} -> #{product.id}")
        end

        if plan.stripe_price_id.blank?
          price = Stripe::Price.create(price_params(plan))
          plan.update!(stripe_price_id: price.id)
          created_prices += 1
          log("price   #{plan.name} -> #{price.id} (#{plan.price_cents} #{plan.currency})")
        end
      end

      Result.new(created_products:, created_prices:)
    end

    private

    # free（無料・price 0）は Stripe オブジェクト不要。
    def target_plans
      Plan.active.where.not(tier: "free")
    end

    def product_params(plan)
      {
        name: product_name(plan),
        metadata: { plan_name: plan.name, tier: plan.tier }
      }
    end

    # 買い切りは同じ tier（topup）で複数あるため、枚数まで名前に入れる。
    # Stripe の一覧で同名が並ぶと、どれがどれだか分からなくなるため。
    def product_name(plan)
      return "ImagePalace クレジット #{plan.credits_per_period}" if plan.one_time?

      "ImagePalace #{plan.tier.to_s.capitalize}"
    end

    def price_params(plan)
      params = {
        product: plan.stripe_product_id,
        currency: plan.currency,
        unit_amount: plan.price_cents,
        metadata: { plan_name: plan.name, credits: plan.credits_per_period }
      }
      # subscription は定期課金、one_time（Top-up）は単発。
      params[:recurring] = { interval: plan.interval } if plan.subscription?
      params
    end

    def log(message)
      @logger&.call(message)
    end
  end
end
