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

      expect(user.reload.credit_grants.where(kind: "topup").sum(:remaining_points))
        .to eq(topup.credits_per_period * Billing::POINTS_PER_CREDIT)
      # 期限付きで積まれるので、内訳では grant 側に出る
      expect(json_response["credit_breakdown"]["grant"]).to be >= topup.credits_per_period
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

      expect(user.reload.credit_grants.where(kind: "topup").sum(:remaining_points))
        .to eq(topup.credits_per_period * Billing::POINTS_PER_CREDIT)
    end

    it "残高を期限ごとに分けて返す（いつ消えるかが分かるように）" do
      get "/api/v1/billing/summary", headers: headers

      buckets = json_response["credit_buckets"]
      expect(buckets).to be_present
      expect(buckets.map { |b| b["kind"] }).to include("trial")
      # 期限が近い順に並ぶ（＝使われる順）
      expiries = buckets.filter_map { |b| b["expires_at"] }
      expect(expiries).to eq(expiries.sort)
      expect(buckets.first["label"]).to be_present
    end

    # 同じ種類でも、期限が違えば別々に出す。まとめてしまうと
    # 「どれがいつ消えるか」が分からなくなり、使い切る判断ができない
    it "同じ種類でも期限が違えば1件ずつ列挙する" do
      user.credit_grants.create!(
        kind: "topup", amount_points: 300, remaining_points: 300, expires_at: 2.months.from_now
      )
      user.credit_grants.create!(
        kind: "topup", amount_points: 500, remaining_points: 500, expires_at: 5.months.from_now
      )

      get "/api/v1/billing/summary", headers: headers

      topups = json_response["credit_buckets"].select { |b| b["kind"] == "topup" }
      expect(topups.size).to eq(2)
      expect(topups.map { |b| b["credits"] }).to contain_exactly(3.0, 5.0)
      # 近いほうが先
      expect(topups.first["expires_at"]).to be < topups.last["expires_at"]
    end

    it "期限なしのぶんは、期限つきの後ろに並べる（先に使われるのは期限つきなので）" do
      user.update!(topup_credits: 100)
      user.credit_grants.create!(
        kind: "topup", amount_points: 200, remaining_points: 200, expires_at: 1.month.from_now
      )

      get "/api/v1/billing/summary", headers: headers

      kinds = json_response["credit_buckets"].map { |b| b["kind"] }
      expect(kinds.last).to eq("topup_legacy")
    end

    it "使い切ったぶんは出さない" do
      user.credit_grants.create!(
        kind: "campaign", amount_points: 300, remaining_points: 0, expires_at: 1.month.from_now
      )

      get "/api/v1/billing/summary", headers: headers

      expect(json_response["credit_buckets"].map { |b| b["kind"] }).not_to include("campaign")
    end
  end
end
