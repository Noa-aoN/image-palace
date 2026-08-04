require "rails_helper"

RSpec.describe "Api::V1::Billing::CreditTransactions", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  def record(kind:, delta:, at: Time.current, **extra)
    CreditTransaction.create!(
      { user: user, kind: kind, delta: delta, created_at: at, updated_at: at }.merge(extra)
    )
  end

  it "未ログインでは見られない" do
    get "/api/v1/billing/credit_transactions", as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "増減をクレジット単位で、日本語の表記付きで返す" do
    record(kind: "topup_purchase", delta: 100 * Billing::POINTS_PER_CREDIT)
    record(kind: "consumption", delta: -1 * Billing::POINTS_PER_CREDIT)

    get "/api/v1/billing/credit_transactions", headers: headers

    expect(response).to have_http_status(:success)
    rows = json_response["transactions"]
    expect(rows.map { |r| r["label"] }).to contain_exactly("クレジット購入", "生成で使用")
    expect(rows.map { |r| r["credits"] }).to contain_exactly(100.0, -1.0)
  end

  it "小数のクレジットも正しく出る（AI調整の 0.01cr など）" do
    record(kind: "consumption", delta: -1)

    get "/api/v1/billing/credit_transactions", headers: headers

    expect(json_response["transactions"].first["credits"]).to eq(-0.01)
  end

  it "新しい順に返す" do
    record(kind: "topup_purchase", delta: 100, at: 2.days.ago)
    record(kind: "consumption", delta: -100, at: 1.hour.ago)

    get "/api/v1/billing/credit_transactions", headers: headers

    expect(json_response["transactions"].map { |r| r["kind"] }).to eq(%w[consumption topup_purchase])
  end

  it "他人の明細は見えない" do
    other = create(:user, :confirmed)
    CreditTransaction.create!(user: other, kind: "topup_purchase", delta: 100)
    record(kind: "consumption", delta: -100)

    get "/api/v1/billing/credit_transactions", headers: headers

    expect(json_response["transactions"].size).to eq(1)
    expect(json_response["transactions"].first["kind"]).to eq("consumption")
  end

  it "その時点の残高の内訳も返す（推移を追えるように）" do
    record(kind: "topup_purchase", delta: 100, subscription_credits_after: 500, topup_credits_after: 100)

    get "/api/v1/billing/credit_transactions", headers: headers

    row = json_response["transactions"].first
    expect(row["subscription_credits_after"]).to eq(5.0)
    expect(row["topup_credits_after"]).to eq(1.0)
  end

  describe "続きの読み込み" do
    before do
      5.times { |i| record(kind: "consumption", delta: -100, at: i.hours.ago) }
    end

    it "limit で件数を絞り、続きの位置を返す" do
      get "/api/v1/billing/credit_transactions", params: { limit: 2 }, headers: headers

      expect(json_response["transactions"].size).to eq(2)
      expect(json_response["next_cursor"]).to be_present
    end

    it "cursor で続きを読める（重複しない）" do
      get "/api/v1/billing/credit_transactions", params: { limit: 2 }, headers: headers
      first_ids = json_response["transactions"].map { |r| r["id"] }
      cursor = json_response["next_cursor"]

      get "/api/v1/billing/credit_transactions", params: { limit: 2, cursor: cursor }, headers: headers
      second_ids = json_response["transactions"].map { |r| r["id"] }

      expect(first_ids & second_ids).to be_empty
    end

    it "最後まで読むと続きは無くなる" do
      get "/api/v1/billing/credit_transactions", params: { limit: 100 }, headers: headers

      expect(json_response["next_cursor"]).to be_nil
    end

    it "limit には上限がある" do
      get "/api/v1/billing/credit_transactions", params: { limit: 9999 }, headers: headers

      expect(json_response["transactions"].size).to be <= 200
    end

    it "壊れた cursor でも落ちない（先頭から返す）" do
      get "/api/v1/billing/credit_transactions", params: { cursor: "これは日時ではない" }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["transactions"].size).to eq(5)
    end
  end
end
