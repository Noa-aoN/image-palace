# frozen_string_literal: true

module Billing
  # DB の Plan 定義から Stripe の Products/Prices を作成し、stripe_product_id /
  # stripe_price_id を埋め戻す。テストキー/本番キーで生成される ID が異なるため、
  # 環境ごとに（その環境の STRIPE_SECRET_KEY で）実行する。free プランは Stripe 不要。
  #
  # Stripe の Price は金額を変更できない。値段を変えたときは**新しい Price を作って
  # 貼り替える**必要がある。ここが「ID が入っていたらスキップ」だけだと、
  # 画面には新価格が出ているのに決済は旧価格で通る、という食い違いが起きる
  # （実際に、表示 ¥1,400・請求 ¥1,200 という取り違えを起こしたことがある）。
  #
  # そのため、ID がある場合も Stripe 側の金額と突き合わせ、
  # ずれていたら作り直して貼り替える。値段を変えたあとは、このタスクを流すだけでよい。
  class SyncPlans
    class MissingApiKey < StandardError; end

    # 商品の税コード。Managed Payments（Stripe が販売者となり各国の消費税を扱う仕組み）が
    # 有効な口座では**必須**で、無いと Checkout Session の作成自体が弾かれる。
    #
    # txcd_10000000 = General - Electronically Supplied Services。
    # 本サービスは物理商品の配送を伴わず、Web 上で完結するデジタル役務
    # （AI 画像生成による学習支援、アプリ内クレジットとサブスクリプション）のため。
    TAX_CODE = "txcd_10000000"

    Result = Struct.new(:created_products, :updated_products, :created_prices, :replaced_prices, keyword_init: true)

    def self.call(...)
      new(...).call
    end

    def initialize(logger: nil)
      @logger = logger
    end

    def call
      raise MissingApiKey, "STRIPE_SECRET_KEY が未設定です" if Stripe.api_key.blank?

      created_products = 0
      updated_products = 0
      created_prices = 0
      replaced_prices = 0

      target_plans.find_each do |plan|
        if plan.stripe_product_id.blank?
          product = Stripe::Product.create(product_params(plan))
          plan.update!(stripe_product_id: product.id)
          created_products += 1
          log("product #{plan.name} -> #{product.id}")
        elsif backfill_tax_code!(plan)
          updated_products += 1
        end

        if plan.stripe_price_id.blank?
          create_price!(plan)
          created_prices += 1
        elsif stale_price?(plan)
          replace_price!(plan)
          replaced_prices += 1
        end
      end

      Result.new(created_products:, updated_products:, created_prices:, replaced_prices:)
    end

    private

    # 既に作られている商品に税コードを入れ直す。
    #
    # Managed Payments が後から既定で有効になり、税コードの無い商品は Checkout Session の
    # 作成ごと弾かれるようになった（2026-08 に本番で発生）。作成時にしか設定していないと
    # 既存商品が取り残されるので、実行のたびに確認して揃える。
    # 商品は消さずに更新するだけなので、Price も購読も影響を受けない。
    def backfill_tax_code!(plan)
      product = Stripe::Product.retrieve(plan.stripe_product_id)
      current = product.tax_code.is_a?(String) ? product.tax_code : product.tax_code&.id
      return false if current == TAX_CODE

      Stripe::Product.update(plan.stripe_product_id, tax_code: TAX_CODE)
      log("tax_code #{plan.name} -> #{TAX_CODE}（旧: #{current.inspect}）")
      true
    rescue Stripe::InvalidRequestError => e
      # 消された商品などで落ちても、他のプランの同期は続ける
      log("tax_code #{plan.name} 失敗: #{e.message}")
      false
    end

    def create_price!(plan)
      price = Stripe::Price.create(price_params(plan))
      plan.update!(stripe_price_id: price.id)
      log("price   #{plan.name} -> #{price.id} (#{plan.price_cents} #{plan.currency})")
    end

    # 貼り替え: 新しい Price を作ってから古い方を無効にする。
    # 順番が逆だと、失敗したときに「有効な Price が無いプラン」が残って決済できなくなる。
    def replace_price!(plan)
      old_id = plan.stripe_price_id
      create_price!(plan)
      deactivate_price(old_id)
      log("replaced #{plan.name}: #{old_id} -> #{plan.stripe_price_id}")
    end

    # Stripe 側の金額・通貨・課金間隔が Plan の定義とずれていないか。
    # 取得できないもの（別環境のキーで作った ID など）は作り直す。
    def stale_price?(plan)
      price = Stripe::Price.retrieve(plan.stripe_price_id)
      return true if price.unit_amount != plan.price_cents
      return true if price.currency != plan.currency
      return true if plan.subscription? && price.recurring&.interval != plan.interval

      false
    rescue Stripe::InvalidRequestError => e
      log("price   #{plan.name}: 取得できないため作り直します (#{e.message})")
      true
    end

    # 古い Price は消せない（過去の決済が参照している）。無効化して選ばれないようにする。
    def deactivate_price(price_id)
      Stripe::Price.update(price_id, active: false)
    rescue Stripe::InvalidRequestError => e
      log("price   旧 #{price_id} の無効化に失敗（無視して続行）: #{e.message}")
    end

    # free（無料・price 0）は Stripe オブジェクト不要。
    def target_plans
      Plan.active.where.not(tier: "free")
    end

    def product_params(plan)
      {
        name: product_name(plan),
        tax_code: TAX_CODE,
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
