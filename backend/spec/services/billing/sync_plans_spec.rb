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

  it "skips plans that already have ids (idempotent)" do
    create(:plan, :standard).update!(stripe_product_id: "prod_x", stripe_price_id: "price_x")

    expect(Stripe::Product).not_to receive(:create)
    expect(Stripe::Price).not_to receive(:create)

    result = described_class.call
    expect(result.created_products).to eq(0)
    expect(result.created_prices).to eq(0)
  end

  it "creates a one_time price (no recurring) for top-up plans" do
    create(:plan, :topup)
    allow(Stripe::Product).to receive(:create).and_return(Stripe::Product.construct_from(id: "prod_t"))
    expect(Stripe::Price).to receive(:create).with(hash_excluding(:recurring)).and_return(
      Stripe::Price.construct_from(id: "price_t")
    )

    described_class.call
  end
end
