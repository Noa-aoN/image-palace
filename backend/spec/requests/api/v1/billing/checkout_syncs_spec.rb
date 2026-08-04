require "rails_helper"

RSpec.describe "Api::V1::Billing::CheckoutSyncs", type: :request do
  let(:user) { create(:user, :confirmed, stripe_customer_id: "cus_1") }
  let(:headers) { auth_headers_for(user) }
  let!(:topup) { create(:plan, :topup).tap { |p| p.update!(stripe_price_id: "price_topup") } }

  def stub_session(overrides = {})
    session = Stripe::Checkout::Session.construct_from({
      id: "cs_test_1", mode: "payment", payment_status: "paid",
      customer: "cus_1", client_reference_id: user.id,
      metadata: { plan_name: topup.name }
    }.merge(overrides))
    allow(Stripe::Checkout::Session).to receive(:retrieve).and_return(session)
  end

  it "未ログインでは取り込めない" do
    post "/api/v1/billing/checkout/sync", params: { session_id: "cs_test_1" }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "支払い済みならクレジットを入れて結果を返す" do
    stub_session

    post "/api/v1/billing/checkout/sync", params: { session_id: "cs_test_1" }, headers: headers, as: :json

    expect(response).to have_http_status(:success)
    expect(json_response["status"]).to eq("paid")
    expect(json_response["applied"]).to be(true)
    expect(user.reload.topup_credits).to eq(topup.credits_per_period * Billing::POINTS_PER_CREDIT)
  end

  it "二度呼んでも増えない" do
    stub_session
    post "/api/v1/billing/checkout/sync", params: { session_id: "cs_test_1" }, headers: headers, as: :json

    expect {
      post "/api/v1/billing/checkout/sync", params: { session_id: "cs_test_1" }, headers: headers, as: :json
    }.not_to(change { user.reload.topup_credits })

    expect(json_response["applied"]).to be(false)
  end

  it "他人の決済は 403" do
    stub_session(customer: "cus_other", client_reference_id: SecureRandom.uuid)

    post "/api/v1/billing/checkout/sync", params: { session_id: "cs_test_1" }, headers: headers, as: :json

    expect(response).to have_http_status(:forbidden)
    expect(user.reload.topup_credits).to eq(0)
  end

  it "決済 id を渡さなくても、直近の支払いから拾って反映する" do
    session = Stripe::Checkout::Session.construct_from(
      id: "cs_test_recent", mode: "payment", payment_status: "paid",
      customer: "cus_1", client_reference_id: user.id, metadata: { plan_name: topup.name }
    )
    allow(Stripe::Checkout::Session).to receive(:list)
      .and_return(Stripe::ListObject.construct_from(data: [ session ]))

    post "/api/v1/billing/checkout/sync", headers: headers, as: :json

    expect(response).to have_http_status(:success)
    expect(json_response["applied"]).to be(true)
    expect(user.reload.topup_credits).to eq(topup.credits_per_period * Billing::POINTS_PER_CREDIT)
  end

  it "Stripe が落ちていても壊れない" do
    allow(Stripe::Checkout::Session).to receive(:retrieve).and_raise(Stripe::APIConnectionError.new("down"))

    post "/api/v1/billing/checkout/sync", params: { session_id: "cs_test_1" }, headers: headers, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_response["error"]).to be_present
  end
end
