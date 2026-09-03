require "rails_helper"

# 運営クレジット。**財布はひとつ**にして、予算は残高へ入れる形にした。
#
# 以前は運営だけ別の財布から引かれていて、残高が1点も動かなかった。
# そのため数え方の不具合にも、使いすぎにも気づけなかった。
RSpec.describe "運営クレジット", type: :request do
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:headers) { auth_headers_for(admin) }

  describe "使うとき" do
    it "運営でも、ほかの利用者と同じように残高から引かれる" do
      admin.credit_grants.create!(kind: "trial", amount_points: 300, remaining_points: 300,
                                  expires_at: 30.days.from_now)

      admin.reload.consume_credits!(100)

      expect(admin.reload.available_credit_points).to eq(200)
    end

    it "1点＝0.01クレジットまで動く（小数第2位が効く）" do
      admin.credit_grants.create!(kind: "trial", amount_points: 300, remaining_points: 300,
                                  expires_at: 30.days.from_now)

      admin.reload.consume_credits!(1)

      expect(admin.reload.available_credits).to eq(2.99)
    end

    it "残高が無ければ、運営でも足りないと言われる" do
      expect { admin.consume_credits!(100) }.to raise_error(User::InsufficientCredits)
    end
  end

  describe "入れるとき" do
    it "運営の予算から自分の残高へ入る" do
      post "/api/v1/admin/ops_credits", params: { credits: 50, reason: "公式カードの作成" }, headers: headers

      expect(response).to have_http_status(:created)
      expect(admin.reload.available_credits).to eq(50.0)
      expect(admin.credit_grants.last.kind).to eq("ops")
    end

    it "理由が無ければ入れられない（あとから追えない記録を残さない）" do
      post "/api/v1/admin/ops_credits", params: { credits: 50, reason: " " }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(admin.reload.available_credit_points).to eq(0)
    end

    it "今月の上限を超えては入れられない" do
      limit = admin.studio_allowance_limit_points / ::Billing::POINTS_PER_CREDIT

      post "/api/v1/admin/ops_credits", params: { credits: limit + 1, reason: "使いすぎ" }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(admin.reload.available_credit_points).to eq(0)
    end

    it "入れたぶんは今月の枠から減る" do
      post "/api/v1/admin/ops_credits", params: { credits: 30, reason: "公式カードの作成" }, headers: headers

      summary = admin.reload.studio_allowance_summary
      expect(summary[:used_credits]).to eq(30.0)
      expect(summary[:remaining_credits]).to eq(summary[:limit_credits] - 30.0)
    end

    it "監査ログに残る" do
      expect {
        post "/api/v1/admin/ops_credits", params: { credits: 10, reason: "検証" }, headers: headers
      }.to change { AdminAuditLog.where(action: "ops_credit_draw").count }.by(1)
    end
  end

  describe "見るとき" do
    it "今月の入れた量・使った量・残高が返る" do
      post "/api/v1/admin/ops_credits", params: { credits: 20, reason: "公式カードの作成" }, headers: headers
      admin.reload.consume_credits!(100)

      get "/api/v1/admin/ops_credits", headers: headers

      row = json_response["accounts"].find { |a| a["id"] == admin.id }
      expect(row["allowance"]["used_credits"]).to eq(20.0)
      expect(row["spent_credits"]).to eq(1.0)
      expect(row["available_credits"]).to eq(19.0)
    end
  end

  it "普通の利用者は触れない" do
    plain = create(:user, :confirmed)

    post "/api/v1/admin/ops_credits", params: { credits: 10, reason: "だめ" }, headers: auth_headers_for(plain)

    expect(response).to have_http_status(:forbidden).or have_http_status(:unauthorized)
  end
end
