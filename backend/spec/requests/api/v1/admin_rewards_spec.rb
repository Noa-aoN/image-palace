require "rails_helper"

# 獲得物・実績・ミッションの管理。1つの入口で扱う。
RSpec.describe "獲得物の管理", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:admin) { create(:user, :confirmed, role: "owner") }
  let(:admin_headers) { auth_headers_for(admin) }

  describe "GET /api/v1/admin/rewards" do
    it "組み込みを取り込んで、3つとも返す" do
      get "/api/v1/admin/rewards", headers: admin_headers

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["rewards"].map { |r| r["key"] }).to include(*RewardDefinition::BUILTIN_KEYS)
      expect(body["achievements"].map { |a| a["key"] }).to include(*AchievementDefinition::BUILTIN_KEYS)
      expect(body["missions"].map { |m| m["key"] }).to include(*MissionDefinition::BUILTIN_KEYS)
      expect(body["series"].map { |s| s["key"] }).to include(*MissionSeries::BUILTIN_KEYS)
    end

    it "何人が持っているかを併せて返す（配りすぎ・配らなすぎに気づくため）" do
      definition = RewardDefinition.registry.first
      UserReward.create!(user: user, reward_definition: definition, granted_at: Time.current)

      get "/api/v1/admin/rewards", headers: admin_headers

      row = response.parsed_body["rewards"].find { |r| r["key"] == definition.key }
      expect(row["owned_count"]).to eq(1)
    end

    it "運営でなければ開けない" do
      get "/api/v1/admin/rewards", headers: headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /api/v1/admin/rewards/definitions/:id" do
    it "レア度と公開を変えられ、監査ログに残る" do
      definition = RewardDefinition.registry.find { |d| d.rarity_level != 7 }

      expect {
        patch "/api/v1/admin/rewards/definitions/#{definition.id}",
          params: { reward: { rarity_level: 7, published: false } }, headers: admin_headers, as: :json
      }.to change { AdminAuditLog.where(action: "reward_definition_update").count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(definition.reload.rarity_level).to eq(7)
      expect(definition.published).to be(false)
    end

    it "取りうる範囲を外れたら断る" do
      definition = RewardDefinition.registry.first

      patch "/api/v1/admin/rewards/definitions/#{definition.id}",
        params: { reward: { rarity_level: 99 } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "PATCH /api/v1/admin/rewards/missions/:id" do
    it "期間を入れて、期間限定にできる" do
      definition = MissionDefinition.registry.first
      starts = 1.day.from_now
      ends = 8.days.from_now

      patch "/api/v1/admin/rewards/missions/#{definition.id}",
        params: { mission: { cadence: "limited", starts_at: starts, ends_at: ends } },
        headers: admin_headers, as: :json

      expect(response).to have_http_status(:ok)
      definition.reload
      expect(definition.cadence).to eq("limited")
      expect(definition.available?(Time.current)).to be(false)
      expect(definition.available?(2.days.from_now)).to be(true)
    end
  end

  describe "POST /api/v1/admin/rewards/grant" do
    let(:definition) { RewardDefinition.registry.first }

    it "理由が無ければ配らない" do
      expect {
        post "/api/v1/admin/rewards/grant",
          params: { user_id: user.id, reward_key: definition.key, reason: "  " },
          headers: admin_headers, as: :json
      }.not_to change(UserReward, :count)

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "理由があれば配り、誰に何をなぜ配ったかを残す" do
      expect {
        post "/api/v1/admin/rewards/grant",
          params: { user_id: user.id, reward_key: definition.key, reason: "不具合のお詫び" },
          headers: admin_headers, as: :json
      }.to change { UserReward.where(user: user).count }.by(1)

      expect(response).to have_http_status(:ok)
      log = AdminAuditLog.where(action: "reward_manual_grant").last
      expect(log.details["reason"]).to eq("不具合のお詫び")
      expect(log.details["reward_key"]).to eq(definition.key)
      expect(log.target_id).to eq(user.id)
    end

    it "既に持っていれば二重に配らない" do
      UserReward.create!(user: user, reward_definition: definition, granted_at: Time.current)

      expect {
        post "/api/v1/admin/rewards/grant",
          params: { user_id: user.id, reward_key: definition.key, reason: "念のため" },
          headers: admin_headers, as: :json
      }.not_to change(UserReward, :count)

      expect(response.parsed_body["granted"]).to be(false)
    end

    it "運営でなければ配れない" do
      post "/api/v1/admin/rewards/grant",
        params: { user_id: user.id, reward_key: definition.key, reason: "test" },
        headers: headers, as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
