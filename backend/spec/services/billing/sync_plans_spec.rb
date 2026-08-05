require "rails_helper"

RSpec.describe Billing::SyncPlans do
  # seed 由来のプランが混ざらないよう、各例で対象を明示的に組み立てる。
  before do
    Stripe.api_key = "sk_test_dummy"
    Plan.delete_all
  end
  after { Stripe.api_key = nil }

  it "raises when the API key is missing" do
    Stripe.api_key = nil
    expect { described_class.call }.to raise_error(described_class::MissingApiKey)
  end

  it "creates a Product and Price for paid plans and backfills the ids" do
    plan = create(:plan, :standard)
    product = Stripe::Product.construct_from(id: "prod_123")
    price = Stripe::Price.construct_from(id: "price_123")

    expect(Stripe::Product).to receive(:create).once.and_return(product)
    expect(Stripe::Price).to receive(:create).once.with(hash_including(
      currency: "jpy", unit_amount: 1480, recurring: { interval: "month" }
    )).and_return(price)

    result = described_class.call

    expect(plan.reload.stripe_product_id).to eq("prod_123")
    expect(plan.stripe_price_id).to eq("price_123")
    expect(result.created_products).to eq(1)
    expect(result.created_prices).to eq(1)
  end

  it "leaves plans alone when Stripe already matches the definition (idempotent)" do
    create(:plan, :standard).update!(stripe_product_id: "prod_x", stripe_price_id: "price_x")
    allow(Stripe::Price).to receive(:retrieve).with("price_x").and_return(
      stripe_price(unit_amount: 1480, interval: "month")
    )

    expect(Stripe::Product).not_to receive(:create)
    expect(Stripe::Price).not_to receive(:create)

    result = described_class.call
    expect(result.created_products).to eq(0)
    expect(result.created_prices).to eq(0)
    expect(result.replaced_prices).to eq(0)
  end

  # Stripe の Price は金額を変更できない。値段を変えたら貼り替えないと、
  # 画面には新価格が出ているのに決済は旧価格で通る。
  describe "値段を変えたとき" do
    let!(:plan) do
      create(:plan, :standard).tap { |p| p.update!(stripe_product_id: "prod_x", stripe_price_id: "price_old") }
    end

    before do
      allow(Stripe::Price).to receive(:retrieve).with("price_old").and_return(
        stripe_price(unit_amount: 1200, interval: "month")
      )
      allow(Stripe::Price).to receive(:update)
      allow(Stripe::Price).to receive(:create).and_return(Stripe::Price.construct_from(id: "price_new"))
    end

    it "新しい Price を作って貼り替える" do
      result = described_class.call

      expect(Stripe::Price).to have_received(:create).with(hash_including(unit_amount: 1480))
      expect(plan.reload.stripe_price_id).to eq("price_new")
      expect(result.replaced_prices).to eq(1)
    end

    it "古い Price は消さずに無効化する（過去の決済が参照しているため）" do
      described_class.call
      expect(Stripe::Price).to have_received(:update).with("price_old", active: false)
    end

    it "新しい Price を作ってから古い方を無効にする" do
      order = []
      allow(Stripe::Price).to receive(:create) do
        order << :create
        Stripe::Price.construct_from(id: "price_new")
      end
      allow(Stripe::Price).to receive(:update) { order << :deactivate }

      described_class.call

      expect(order).to eq(%i[create deactivate])
    end

    it "古い Price の無効化に失敗しても、貼り替えは完了させる" do
      allow(Stripe::Price).to receive(:update).and_raise(Stripe::InvalidRequestError.new("gone", nil))

      expect { described_class.call }.not_to raise_error
      expect(plan.reload.stripe_price_id).to eq("price_new")
    end
  end

  it "課金間隔がずれていても貼り替える" do
    create(:plan, :standard).update!(stripe_product_id: "prod_x", stripe_price_id: "price_old")
    allow(Stripe::Price).to receive(:retrieve).and_return(
      stripe_price(unit_amount: 1480, interval: "year")
    )
    allow(Stripe::Price).to receive(:update)
    allow(Stripe::Price).to receive(:create).and_return(Stripe::Price.construct_from(id: "price_new"))

    expect(described_class.call.replaced_prices).to eq(1)
  end

  it "Stripe 側に無い Price（別環境のキーで作った等）は作り直す" do
    plan = create(:plan, :standard)
    plan.update!(stripe_product_id: "prod_x", stripe_price_id: "price_missing")
    allow(Stripe::Price).to receive(:retrieve).and_raise(Stripe::InvalidRequestError.new("No such price", nil))
    allow(Stripe::Price).to receive(:update)
    allow(Stripe::Price).to receive(:create).and_return(Stripe::Price.construct_from(id: "price_new"))

    expect(described_class.call.replaced_prices).to eq(1)
    expect(plan.reload.stripe_price_id).to eq("price_new")
  end

  it "creates a one_time price (no recurring) for top-up plans" do
    create(:plan, :topup)
    allow(Stripe::Product).to receive(:create).and_return(Stripe::Product.construct_from(id: "prod_t"))
    expect(Stripe::Price).to receive(:create).with(hash_excluding(:recurring)).and_return(
      Stripe::Price.construct_from(id: "price_t")
    )

    described_class.call
  end

  def stripe_price(unit_amount:, interval: nil, currency: "jpy")
    attrs = { id: "price_x", unit_amount:, currency: }
    attrs[:recurring] = { interval: } if interval
    Stripe::Price.construct_from(attrs)
  end
end
