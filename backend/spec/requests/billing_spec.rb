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

  describe "GET /api/v1/billing/plans" do
    it "requires authentication" do
      get "/api/v1/billing/plans", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns active plans" do
      user = create(:user, :confirmed)
      create(:plan, :standard)

      get "/api/v1/billing/plans", headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:ok)
      names = json_response["plans"].map { |p| p["name"] }
      expect(names).to include("standard")
    end
  end

  describe "GET /api/v1/billing/summary" do
    it "returns the current credit balance and plan" do
      user = create(:user, :confirmed)

      get "/api/v1/billing/summary", headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:ok)
      # 無料枠が lazy 付与され、free プランの 10cr が表示される
      expect(json_response["available_credits"]).to eq(10.0)
      expect(json_response.dig("plan", "name")).to eq("free")
    end

    it "無料会員の next_credit_reset は登録日アニバーサリーの翌周期を返す" do
      user = create(:user, :confirmed)
      user.update_column(:created_at, Time.zone.local(2026, 1, 15, 10, 0, 0))

      travel_to(Time.zone.local(2026, 6, 20, 12, 0, 0)) do
        get "/api/v1/billing/summary", headers: auth_headers_for(user), as: :json
      end

      expect(response).to have_http_status(:ok)
      # 1/15 登録 → 現周期 6/15、次回 7/15
      expect(Time.zone.parse(json_response["next_credit_reset"])).to eq(Time.zone.local(2026, 7, 15, 10, 0, 0))
    end

    it "credit_breakdown（サブスク/ボーナス/チャージ）と最も近い期限を返す" do
      user = create(:user, :confirmed)
      user.grant_credits!(3 * Billing::POINTS_PER_CREDIT, kind: "campaign", expires_at: Time.zone.local(2026, 12, 1))

      get "/api/v1/billing/summary", headers: auth_headers_for(user), as: :json

      bd = json_response["credit_breakdown"]
      # 契約が無いので月額分は 0。お試し枠（10）とキャンペーン（3）は期限付きグラント側に入る
      expect(bd["subscription"]).to eq(0.0)
      expect(bd["grant"]).to eq(Billing::Catalog::TRIAL_CREDITS + 3.0)
      expect(bd["topup"]).to eq(0.0)
      # 期限がいちばん近いもの（キャンペーンの方がお試し枠の6ヶ月後より早い）
      expect(Time.zone.parse(bd["grant_expires_at"])).to eq(Time.zone.local(2026, 12, 1))
    end
  end
end
