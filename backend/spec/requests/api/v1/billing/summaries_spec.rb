require "rails_helper"

RSpec.describe "Api::V1::Billing::Summaries", type: :request do
  let(:user) { create(:user, :confirmed, stripe_customer_id: "cus_1") }
  let(:headers) { auth_headers_for(user) }
  let!(:free) { create(:plan) }

  before do
    # 既定では Stripe を呼ばない（呼ぶ例だけ明示的に開ける）
    allow(Stripe::Checkout::Session).to receive(:list)
      .and_return(Stripe::ListObject.construct_from(data: []))
  end

  it "未ログインでは見られない" do
    get "/api/v1/billing/summary", as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "残高とプランを返す" do
    get "/api/v1/billing/summary", headers: headers

    expect(response).to have_http_status(:success)
    expect(json_response["available_credits"]).to eq((Billing::Catalog::TRIAL_CREDITS + Billing::Catalog::MONTHLY_FREE_CREDITS))
    expect(json_response["plan"]["name"]).to eq("free")
  end

  describe "支払いの自動反映" do
    let(:topup) { create(:plan, :topup) }

    def paid_session(id)
      Stripe::Checkout::Session.construct_from(
        id: id, mode: "payment", payment_status: "paid",
        customer: "cus_1", client_reference_id: user.id,
        metadata: { plan_name: topup.name }
      )
    end

    it "未反映の支払いがあれば、残高を見た時点で反映する" do
      topup
      allow(Stripe::Checkout::Session).to receive(:list)
        .and_return(Stripe::ListObject.construct_from(data: [ paid_session("cs_auto") ]))

      get "/api/v1/billing/summary", headers: headers

      expect(json_response["credit_breakdown"]["topup"]).to eq(topup.credits_per_period)
      expect(user.reload.topup_credits).to eq(topup.credits_per_period * Billing::POINTS_PER_CREDIT)
    end

    it "続けて見ても Stripe を叩き直さない（間隔を空ける）" do
      get "/api/v1/billing/summary", headers: headers
      get "/api/v1/billing/summary", headers: headers

      expect(Stripe::Checkout::Session).to have_received(:list).once
    end

    it "間隔が空いたら叩き直す" do
      get "/api/v1/billing/summary", headers: headers
      user.update!(stripe_reconciled_at: (Billing::AutoReconciler::INTERVAL + 1.minute).ago)

      get "/api/v1/billing/summary", headers: headers

      expect(Stripe::Checkout::Session).to have_received(:list).twice
    end

    it "顧客がまだ無いなら Stripe を叩かない" do
      user.update!(stripe_customer_id: nil)

      get "/api/v1/billing/summary", headers: headers

      expect(response).to have_http_status(:success)
      expect(Stripe::Checkout::Session).not_to have_received(:list)
    end

    it "Stripe が落ちていても残高は見られる" do
      allow(Stripe::Checkout::Session).to receive(:list).and_raise(Stripe::APIConnectionError.new("down"))

      get "/api/v1/billing/summary", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["available_credits"]).to eq((Billing::Catalog::TRIAL_CREDITS + Billing::Catalog::MONTHLY_FREE_CREDITS))
    end

    it "同じ支払いを二度反映しない" do
      topup
      allow(Stripe::Checkout::Session).to receive(:list)
        .and_return(Stripe::ListObject.construct_from(data: [ paid_session("cs_auto") ]))

      get "/api/v1/billing/summary", headers: headers
      user.update!(stripe_reconciled_at: nil)
      get "/api/v1/billing/summary", headers: headers

      expect(user.reload.topup_credits).to eq(topup.credits_per_period * Billing::POINTS_PER_CREDIT)
    end
  end
end
