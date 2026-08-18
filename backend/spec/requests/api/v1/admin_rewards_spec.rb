require "rails_helper"

# 獲得物・実績・ミッションの管理。1つの入口で扱う。
RSpec.describe "獲得物の管理", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
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

  # 「定義を作る」と「ユーザーへ配る」は別のこと。
  # ここで増えるのは**何があるか**であって、誰かの持ち物ではない。
  describe "定義を作る" do
    describe "POST /api/v1/admin/rewards/definitions" do
      let(:params) do
        { reward: { key: "medal_new_thing", kind: "medal", name: "新しい勲章",
                    description: "手で作ったもの", rarity_level: 3 } }
      end

      it "作れて、一覧に載り、監査ログに残る" do
        expect {
          post "/api/v1/admin/rewards/definitions", params: params, headers: admin_headers, as: :json
        }.to change(RewardDefinition, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(json_response["reward"]["key"]).to eq("medal_new_thing")

        get "/api/v1/admin/rewards", headers: admin_headers
        expect(json_response["rewards"].map { |r| r["key"] }).to include("medal_new_thing")

        log = AdminAuditLog.find_by(action: "reward_definition_create")
        expect(log.details["key"]).to eq("medal_new_thing")
      end

      # 誰の持ち物も増えない。ここを混ぜると「作ったつもりが配っていた」になる
      it "誰にも配られない" do
        expect {
          post "/api/v1/admin/rewards/definitions", params: params, headers: admin_headers, as: :json
        }.not_to change(UserReward, :count)
      end

      it "同じ鍵は二度作れない（組み込みの上書きを防ぐ）" do
        post "/api/v1/admin/rewards/definitions", params: params, headers: admin_headers, as: :json

        expect {
          post "/api/v1/admin/rewards/definitions", params: params, headers: admin_headers, as: :json
        }.not_to change(RewardDefinition, :count)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_response["errors"].join).to include("既に存在します").or include("taken")
      end

      it "知らない種別は断る" do
        post "/api/v1/admin/rewards/definitions",
          params: { reward: { key: "x_thing", kind: "unknown_kind", name: "あ" } },
          headers: admin_headers, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "運営でなければ作れない" do
        expect {
          post "/api/v1/admin/rewards/definitions", params: params, headers: headers, as: :json
        }.not_to change(RewardDefinition, :count)

        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "POST /api/v1/admin/rewards/achievements" do
      it "条件つきで作れる" do
        expect {
          post "/api/v1/admin/rewards/achievements",
            params: { achievement: { key: "made_here", name: "ここで作った実績",
                                     condition_type: "cards_created", condition_target: 3,
                                     category: "作成" } },
            headers: admin_headers, as: :json
        }.to change(AchievementDefinition, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(json_response["achievement"]["condition_target"]).to eq(3)
      end

      # 数える手立てが無い条件は、いつまでも達成にならない。作る時点で気づけるようにする
      it "数えられない条件は断る" do
        expect {
          post "/api/v1/admin/rewards/achievements",
            params: { achievement: { key: "impossible", name: "無理", condition_type: "does_not_exist" } },
            headers: admin_headers, as: :json
        }.not_to change(AchievementDefinition, :count)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_response["errors"].join).to include("数える手立てがありません")
      end

      it "無い獲得物を報酬に指定したら断る" do
        post "/api/v1/admin/rewards/achievements",
          params: { achievement: { key: "bad_reward", name: "あ", condition_type: "cards_created",
                                   rewards: [ { type: "reward", key: "no_such_reward" } ] } },
          headers: admin_headers, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    describe "POST /api/v1/admin/rewards/missions" do
      it "作れて、一覧に載る" do
        expect {
          post "/api/v1/admin/rewards/missions",
            params: { mission: { key: "daily_made", name: "手で作った日課",
                                 condition_type: "cards_created", condition_target: 1,
                                 cadence: "daily" } },
            headers: admin_headers, as: :json
        }.to change(MissionDefinition, :count).by(1)

        expect(response).to have_http_status(:created)

        get "/api/v1/admin/rewards", headers: admin_headers
        expect(json_response["missions"].map { |m| m["key"] }).to include("daily_made")
      end

      it "知らない周期は断る" do
        post "/api/v1/admin/rewards/missions",
          params: { mission: { key: "odd_cadence", name: "あ", condition_type: "cards_created",
                               cadence: "hourly" } },
          headers: admin_headers, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end

      # 画面から作るミッションは、たいてい連なりに属さない単発のもの。
      # 連なり（series）を必須にしていないことを、ここで押さえる
      it "連なりに属さない単発でも、一覧に出て達成できる" do
        post "/api/v1/admin/rewards/missions",
          params: { mission: { key: "standalone", name: "単発の課題",
                               condition_type: "cards_created", condition_target: 1,
                               cadence: "onboarding" } },
          headers: admin_headers, as: :json
        expect(response).to have_http_status(:created)

        definition = MissionDefinition.find_by(key: "standalone")
        expect(definition.mission_series_id).to be_nil

        # 利用者の一覧に出る（連なりの前提が無くても開いている）
        item_type = ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" }
        user.items.create!(title: "あ", item_type: item_type, generation_status: "completed")
        ::Achievements::Evaluator.call(user: user)

        get "/api/v1/achievements", headers: headers
        listed = json_response["missions"].find { |m| m["key"] == "standalone" }
        expect(listed).to be_present
        expect(listed["completed"]).to be(true)
      end
    end
  end

  # 絵を作る仕組みは既にあった（rake からしか呼べなかった）。
  # **作った獲得物に、その場で絵を付けられる**ようにしたぶんの確認。
  describe "獲得物の絵" do
    let(:definition) { RewardDefinition.registry.first }

    describe "POST /api/v1/admin/rewards/definitions/:id/image" do
      it "作れて、監査ログに残る" do
        allow(::Achievements::ImageGenerator).to receive(:call).and_return(true)

        expect {
          post "/api/v1/admin/rewards/definitions/#{definition.id}/image",
            headers: admin_headers, as: :json
        }.to change { AdminAuditLog.where(action: "reward_image_generate").count }.by(1)

        expect(response).to have_http_status(:ok)
      end

      # 絵が無くても定義は使える（種別ごとの既定の絵柄で出る）。
      # 失敗を理由に定義を壊さない
      it "作れなかったときは、定義を壊さずに断る" do
        allow(::Achievements::ImageGenerator).to receive(:call).and_raise(StandardError, "boom")

        post "/api/v1/admin/rewards/definitions/#{definition.id}/image",
          headers: admin_headers, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(definition.reload).to be_present
      end

      it "運営でなければ作れない" do
        post "/api/v1/admin/rewards/definitions/#{definition.id}/image",
          headers: headers, as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "DELETE /api/v1/admin/rewards/definitions/:id/image" do
      it "外せて、監査ログに残る（定義は残る）" do
        expect {
          delete "/api/v1/admin/rewards/definitions/#{definition.id}/image",
            headers: admin_headers, as: :json
        }.to change { AdminAuditLog.where(action: "reward_image_destroy").count }.by(1)

        expect(response).to have_http_status(:ok)
        expect(definition.reload.image_key).to be_nil
      end

      # 外した判断が、組み込みの取り込みで覆されないこと。
      # 「絵が無い」は「まだ入れていない」と同じ形なので、印が無いと埋め直される
      it "外したあとに組み込みを取り込んでも、絵は戻らない" do
        delete "/api/v1/admin/rewards/definitions/#{definition.id}/image",
          headers: admin_headers, as: :json
        expect(response).to have_http_status(:ok)

        RewardDefinition.instance_variable_set(:@builtins_checked, false)
        RewardDefinition.forget_registry!
        RewardDefinition.ensure_builtins!

        expect(definition.reload.image_key).to be_nil
        expect(definition.image_path).to be_nil
      end

      it "運営でなければ外せない" do
        delete "/api/v1/admin/rewards/definitions/#{definition.id}/image",
          headers: headers, as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  # 押し直し・再送で二重に配らないための鍵。
  #
  # **理由（reason）は鍵にしない。** 同じ理由で別の日に配るのは正しい2回目で、
  # 理由を鍵にすると、その正しい配布まで止まる
  describe "手で配るときの冪等" do
    let(:treasure) { RewardDefinition.registry.find { |d| d.kind == "treasure" } }
    let(:title) { RewardDefinition.registry.find { |d| d.kind == "title" } }

    def post_grant(reward, event_key: nil, reason: "不具合のお詫び")
      post "/api/v1/admin/rewards/grant",
        params: { user_id: user.id, reward_key: reward.key, reason: reason, event_key: event_key }.compact,
        headers: admin_headers, as: :json
    end

    it "ふつうに配ると1個" do
      post_grant(treasure, event_key: "admin:grant:abc")

      expect(response).to have_http_status(:ok)
      expect(json_response["granted"]).to be(true)
      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(1)
    end

    # ここが要。同じ操作を送り直しても増えない
    it "同じ鍵を再送しても増えない" do
      post_grant(treasure, event_key: "admin:grant:abc")
      post_grant(treasure, event_key: "admin:grant:abc")

      expect(response).to have_http_status(:ok)
      expect(json_response["granted"]).to be(false)
      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(1)
    end

    it "何度送り直しても、受け取りの記録は1件" do
      3.times { post_grant(treasure, event_key: "admin:grant:abc") }

      expect(UserRewardGrant.where(user: user, reward_definition: treasure).count).to eq(1)
    end

    it "別の鍵なら、宝物は正しく増える" do
      post_grant(treasure, event_key: "admin:grant:one")
      post_grant(treasure, event_key: "admin:grant:two")

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(2)
    end

    it "称号は別の鍵でも増えない" do
      post_grant(title, event_key: "admin:grant:one")
      post_grant(title, event_key: "admin:grant:two")

      expect(UserReward.find_by(user: user, reward_definition: title).quantity).to eq(1)
    end

    # 鍵を送ってこない古い画面からの呼び出しは、これまでどおり毎回配る
    it "鍵が無ければ、これまでどおり毎回配る" do
      post_grant(treasure)
      post_grant(treasure)

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(2)
    end

    # 「配った」だけを残すと、二重に押した跡が消えて後から追えない
    it "再送のときも監査ログに残る（配っていないことが分かる形で）" do
      post_grant(treasure, event_key: "admin:grant:abc")
      post_grant(treasure, event_key: "admin:grant:abc")

      logs = AdminAuditLog.where(action: "reward_manual_grant").order(:created_at)
      expect(logs.count).to eq(2)
      expect(logs.first.details["granted"]).to be(true)
      expect(logs.last.details["granted"]).to be(false)
      expect(logs.last.details["resent"]).to be(true)
    end
  end
end
