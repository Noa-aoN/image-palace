require "rails_helper"

RSpec.describe "Billing endpoints", type: :request do
  describe "POST /api/v1/billing/checkout" do
    it "requires authentication" do
      post "/api/v1/billing/checkout", params: { plan: "standard" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns the checkout url for an authenticated user" do
      user = create(:user, :confirmed)
      plan = create(:plan, :standard).tap { |p| p.update!(stripe_price_id: "price_std") }
      session = Stripe::Checkout::Session.construct_from(url: "https://checkout.stripe.test/abc")
      allow(Billing::CheckoutSession).to receive(:call).and_return(session)

      post "/api/v1/billing/checkout",
        params: { plan: plan.name },
        headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response["url"]).to eq("https://checkout.stripe.test/abc")
    end
  end

  describe "POST /api/v1/stripe/webhook" do
    it "returns 400 on an invalid signature" do
      allow(Billing::WebhookHandler).to receive(:call).and_raise(Billing::WebhookHandler::SignatureError)

      post "/api/v1/stripe/webhook", params: "{}", headers: { "Stripe-Signature" => "bad" }
      expect(response).to have_http_status(:bad_request)
    end

    it "returns 200 on a handled event" do
      allow(Billing::WebhookHandler).to receive(:call).and_return("invoice.paid")

      post "/api/v1/stripe/webhook", params: "{}", headers: { "Stripe-Signature" => "sig" }
      expect(response).to have_http_status(:ok)
    end
  end
end
