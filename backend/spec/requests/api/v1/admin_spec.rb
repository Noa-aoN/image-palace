require "rails_helper"

RSpec.describe "Api::V1::Admin", type: :request do
  let(:member) { create(:user, :confirmed) }
  let(:member_headers) { auth_headers_for(member) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:admin_headers) { auth_headers_for(admin) }
  let(:owner) { create(:user, :confirmed, role: "owner") }
  let(:owner_headers) { auth_headers_for(owner) }

  describe "入れる人の切り分け" do
    paths = {
      "GET /api/v1/admin/overview" => [ :get, "/api/v1/admin/overview" ],
      "GET /api/v1/admin/users" => [ :get, "/api/v1/admin/users" ],
      "GET /api/v1/admin/audit_logs" => [ :get, "/api/v1/admin/audit_logs" ]
    }

    paths.each do |label, (verb, path)|
      it "#{label} は未ログインでは見られない" do
        public_send(verb, path, as: :json)
        expect(response).to have_http_status(:unauthorized)
      end

      it "#{label} は一般ユーザーには 403" do
        public_send(verb, path, headers: member_headers)
        expect(response).to have_http_status(:forbidden)
        expect(json_response["error"]).to eq("権限がありません")
      end

      it "#{label} は運営なら見られる" do
        public_send(verb, path, headers: admin_headers)
        expect(response).to have_http_status(:success)
      end
    end
  end

  describe "GET /api/v1/admin/session" do
    it "一般ユーザーには権限が無いことを返す（403 にはしない）" do
      get "/api/v1/admin/session", headers: member_headers

      expect(response).to have_http_status(:success)
      expect(json_response["admin"]).to be(false)
      expect(json_response["owner"]).to be(false)
      expect(json_response["role"]).to eq("user")
    end

    it "運営には運営であることを返す" do
      get "/api/v1/admin/session", headers: admin_headers

      expect(json_response["admin"]).to be(true)
      expect(json_response["owner"]).to be(false)
    end

    it "未ログインでは見られない" do
      get "/api/v1/admin/session", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "環境変数での指定（最初のひとり・締め出しの逃げ道）" do
    before do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("ADMIN_EMAILS", "").and_return(member.email.upcase)
    end

    it "指定されたアドレスは運営の管理者として扱う" do
      get "/api/v1/admin/session", headers: member_headers

      expect(json_response["owner"]).to be(true)
      expect(json_response["role"]).to eq("owner")
    end

    it "未確認のアドレスには効かせない（アドレスを騙るだけで入れないように）" do
      unconfirmed = create(:user)
      allow(ENV).to receive(:fetch).with("ADMIN_EMAILS", "").and_return(unconfirmed.email)

      expect(unconfirmed.owner?).to be(false)
    end

    it "Google でログインしたアカウントでも効く（確認済みとして作られるため）" do
      google_user = User.find_for_oauth(
        "provider" => "google_oauth2", "uid" => "1234567890",
        "info" => { "email" => "owner@example.com", "name" => "運営" }
      )
      allow(ENV).to receive(:fetch).with("ADMIN_EMAILS", "").and_return("owner@example.com")

      expect(google_user.provider).to eq("google_oauth2")
      expect(google_user.confirmed_at).to be_present
      expect(google_user.owner?).to be(true)
    end

    it "別のアドレスの Google アカウントには効かない" do
      other = User.find_for_oauth(
        "provider" => "google_oauth2", "uid" => "9999999999",
        "info" => { "email" => "someone-else@example.com", "name" => "他人" }
      )
      allow(ENV).to receive(:fetch).with("ADMIN_EMAILS", "").and_return("owner@example.com")

      expect(other.admin?).to be(false)
    end

    it "指定が空なら誰も運営にならない" do
      allow(ENV).to receive(:fetch).with("ADMIN_EMAILS", "").and_return("")

      expect(User.all.none?(&:admin?)).to be(true)
    end

    it "指定を外すと、その場で入れなくなる（役割は毎回読み直す）" do
      allow(ENV).to receive(:fetch).with("ADMIN_EMAILS", "").and_return("")

      get "/api/v1/admin/overview", headers: member_headers

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/admin/overview" do
    it "数字をまとめて返す" do
      item_type = ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" }
      member.items.create!(title: "あ", item_type: item_type, generation_status: "completed")

      get "/api/v1/admin/overview", headers: admin_headers

      expect(response).to have_http_status(:success)
      expect(json_response["users"]["total"]).to be >= 2
      expect(json_response["content"]["items"]).to eq(1)
      expect(json_response["generation"]["by_status"]["completed"]).to eq(1)
      expect(json_response["series"]["new_users"].size).to eq(Admin::OverviewService::SERIES_DAYS)
      expect(json_response["billing"]).to have_key("paid_rate")
      expect(json_response["ai"]).to have_key("by_kind")
    end

    it "データが空でも壊れない（割り算のゼロ除算を踏まない）" do
      get "/api/v1/admin/overview", headers: admin_headers

      expect(response).to have_http_status(:success)
      expect(json_response["generation"]["cache_hit_rate"]).to eq(0.0)
      expect(json_response["billing"]["paid_rate"]).to be_a(Numeric)
    end
  end

  describe "未使用クレジット（これから出ていく約束）" do
    let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

    it "期限の有無で分けて返す" do
      member.update!(subscription_credits: 300, topup_credits: 500)
      member.credit_grants.create!(
        kind: "free_carryover", amount_points: 200, remaining_points: 200, expires_at: 1.month.from_now
      )
      member.credit_grants.create!(kind: "grant", amount_points: 100, remaining_points: 100, expires_at: nil)

      get "/api/v1/admin/overview", headers: admin_headers

      liability = json_response["credit_liability"]
      # 期限付き = 月額の当月分(3.0) + 期限付きグラント(2.0)
      expect(liability["expiring"]).to eq(5.0)
      # 無期限 = 買い切り(5.0) + 期限の無いグラント(1.0)
      expect(liability["unlimited"]).to eq(6.0)
      expect(liability["total"]).to eq(11.0)
    end

    it "どこに溜まっているかの内訳を返す" do
      member.update!(subscription_credits: 100, topup_credits: 200)

      get "/api/v1/admin/overview", headers: admin_headers

      breakdown = json_response["credit_liability"]["breakdown"]
      expect(breakdown["subscription"]).to eq(1.0)
      expect(breakdown["topup"]).to eq(2.0)
    end

    it "使い切られたグラントは数えない" do
      member.credit_grants.create!(
        kind: "grant", amount_points: 500, remaining_points: 0, expires_at: 1.month.from_now
      )

      get "/api/v1/admin/overview", headers: admin_headers

      expect(json_response["credit_liability"]["expiring"]).to eq(0.0)
    end

    it "直近で失効したぶんを返す（使われずに消えた量）" do
      CreditTransaction.create!(user: member, kind: "subscription_expire", delta: -400)

      get "/api/v1/admin/overview", headers: admin_headers

      expect(json_response["credit_liability"]["expired_last_30d"]).to eq(4.0)
    end

    it "未使用の買い切りぶんを金額に換算する（畳むときの目安）" do
      # 100枚を1,200円で購入し、半分だけ使った状態
      member.update!(topup_credits: 50 * Billing::POINTS_PER_CREDIT)
      CreditTransaction.create!(
        user: member, kind: "topup_purchase", delta: 100 * Billing::POINTS_PER_CREDIT,
        amount_cents: 1200, currency: "jpy"
      )

      get "/api/v1/admin/overview", headers: admin_headers

      expect(json_response["credit_liability"]["unused_topup_value"]).to eq(600)
    end

    it "購入が無ければ金額換算は 0（0 除算を踏まない）" do
      get "/api/v1/admin/overview", headers: admin_headers

      expect(json_response["credit_liability"]["unused_topup_value"]).to eq(0)
    end

    it "いちばん近い期限を返す" do
      member.credit_grants.create!(
        kind: "grant", amount_points: 100, remaining_points: 100, expires_at: 3.days.from_now
      )
      member.credit_grants.create!(
        kind: "grant", amount_points: 100, remaining_points: 100, expires_at: 30.days.from_now
      )

      get "/api/v1/admin/overview", headers: admin_headers

      expect(Time.zone.parse(json_response["credit_liability"]["next_expiry_at"]).to_date)
        .to eq(3.days.from_now.to_date)
    end
  end

  describe "GET /api/v1/admin/users" do
    it "検索と絞り込みができる" do
      target = create(:user, :confirmed, email: "findme@example.com")

      get "/api/v1/admin/users", params: { q: "findme" }, headers: admin_headers

      expect(json_response["users"].map { |u| u["id"] }).to eq([ target.id ])
    end

    it "役割で絞り込める" do
      admin
      get "/api/v1/admin/users", params: { role: "admin" }, headers: admin_headers

      expect(json_response["users"].map { |u| u["role"] }.uniq).to eq([ "admin" ])
    end

    it "秘密は返さない" do
      get "/api/v1/admin/users", headers: admin_headers

      keys = json_response["users"].first.keys
      expect(keys).not_to include("encrypted_password", "tokens", "reset_password_token")
    end
  end

  describe "PATCH /api/v1/admin/users/:id/role" do
    it "一般ユーザーには 403" do
      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "admin" }, headers: member_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "運営（owner ではない）にも 403" do
      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "admin" }, headers: admin_headers

      expect(response).to have_http_status(:forbidden)
      expect(member.reload.role).to eq("user")
    end

    it "owner は役割を変えられ、記録が残る" do
      expect {
        patch "/api/v1/admin/users/#{member.id}/role", params: { role: "admin" }, headers: owner_headers
      }.to change(AdminAuditLog, :count).by(1)

      expect(response).to have_http_status(:success)
      expect(member.reload.role).to eq("admin")

      log = AdminAuditLog.last
      expect(log.action).to eq("user.role_changed")
      expect(log.actor_email).to eq(owner.email)
      expect(log.details["from"]).to eq("user")
      expect(log.details["to"]).to eq("admin")
    end

    it "譲渡（owner への引き上げ）ができる" do
      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "owner" }, headers: owner_headers

      expect(member.reload.role).to eq("owner")
    end

    it "自分の役割は変えられない（締め出しを防ぐ）" do
      patch "/api/v1/admin/users/#{owner.id}/role", params: { role: "user" }, headers: owner_headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(owner.reload.role).to eq("owner")
    end

    it "知らない役割は受け付けない" do
      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "superuser" }, headers: owner_headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(member.reload.role).to eq("user")
    end

    it "環境変数で指定された人の役割は画面から変えられない" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("ADMIN_EMAILS", "").and_return(member.email)

      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "user" }, headers: owner_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "GET /api/v1/admin/audit_logs" do
    it "新しい順に返す" do
      AdminAuditLog.record!(actor: owner, action: "古い操作")
      AdminAuditLog.last.update_column(:created_at, 1.day.ago)
      AdminAuditLog.record!(actor: owner, action: "新しい操作")

      get "/api/v1/admin/audit_logs", headers: admin_headers

      expect(json_response["logs"].map { |l| l["action"] }).to eq([ "新しい操作", "古い操作" ])
    end
  end
end
