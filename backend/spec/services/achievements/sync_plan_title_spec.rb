require "rails_helper"

RSpec.describe Achievements::SyncPlanTitle do
  let(:user) { create(:user) }

  # 定義は組み込み。引けないと何も配らないまま通ってしまうので、先に入れておく
  before { RewardDefinition.registry }

  def rank(tier)
    RewardDefinition.rank_for_tier(tier)
  end

  def held_titles(target = user)
    UserReward.held.joins(:reward_definition)
              .where(user_id: target.id, reward_definitions: { kind: "title" })
              .pluck(:key)
  end

  def subscribe!(tier, status: "active")
    plan = tier == "standard" ? create(:plan, :standard) : create(:plan, name: tier, tier: tier)
    create(:subscription, user: user, plan: plan, status: status)
  end

  describe "いまの契約に合わせる" do
    it "契約が無ければ市民の位を持つ" do
      described_class.call(user: user)

      expect(held_titles).to contain_exactly("title_rank_free")
    end

    it "契約していれば、その段の位を持つ" do
      subscribe!("standard")
      described_class.call(user: user)

      expect(held_titles).to contain_exactly("title_rank_standard")
    end

    # trialing も契約している状態。試用中だけ位が無いと、格下げされたように見える
    it "試用中も位を持つ" do
      subscribe!("standard", status: "trialing")
      described_class.call(user: user)

      expect(held_titles).to contain_exactly("title_rank_standard")
    end

    # 支払いが滞れば active から外れる。期末失効の便りを待たずに落ちる
    it "支払いが滞っていれば市民へ落ちる" do
      subscribe!("standard", status: "past_due")
      described_class.call(user: user)

      expect(held_titles).to contain_exactly("title_rank_free")
    end
  end

  describe "位は同時に1つだけ" do
    it "格上げすると、前の位は外れる" do
      described_class.call(user: user)
      subscribe!("standard")
      described_class.call(user: user)

      expect(held_titles).to contain_exactly("title_rank_standard")
    end

    it "解約すると、有料の位が外れて市民になる" do
      sub = subscribe!("standard")
      described_class.call(user: user)
      sub.update!(status: "canceled")
      described_class.call(user: user)

      expect(held_titles).to contain_exactly("title_rank_free")
    end
  end

  describe "履歴を残す" do
    it "外した位は行ごと消さない" do
      subscribe!("standard").tap { described_class.call(user: user) }
      Subscription.update_all(status: "canceled")
      described_class.call(user: user)

      revoked = UserReward.find_by(user_id: user.id, reward_definition_id: rank("standard").id)
      expect(revoked).to be_present
      expect(revoked.held?).to be(false)
      expect(revoked.revoked_at).to be_present
    end

    # ここが行を消さない理由。消して作り直すと「初めて」が今日になる
    it "取り直しても、初めて手にした日は変わらない" do
      sub = subscribe!("standard")
      travel_to(3.months.ago) { described_class.call(user: user) }
      first = UserReward.find_by(user_id: user.id, reward_definition_id: rank("standard").id).first_acquired_at

      sub.update!(status: "canceled")
      described_class.call(user: user)
      sub.update!(status: "active")
      described_class.call(user: user)

      restored = UserReward.find_by(user_id: user.id, reward_definition_id: rank("standard").id)
      expect(restored.held?).to be(true)
      expect(restored.first_acquired_at).to be_within(1.second).of(first)
      expect(restored.last_acquired_at).to be > first
    end
  end

  describe "何度呼んでも同じ結果になる" do
    # 便りは再送される。2回来ただけで位が増えたり消えたりしてはいけない
    it "2回呼んでも持ち物は増えない" do
      subscribe!("standard")
      described_class.call(user: user)

      expect { described_class.call(user: user) }
        .not_to change { UserReward.held.where(user_id: user.id).count }
    end

    # 便りは順番が入れ替わって届く。古い便りが後から来ても、最後は正しい姿になる
    it "古い便りが後から来ても、いまの契約が残る" do
      sub = subscribe!("standard")
      described_class.call(user: user)
      sub.update!(status: "canceled")
      described_class.call(user: user)
      sub.update!(status: "active")
      described_class.call(user: user)
      described_class.call(user: user)

      expect(held_titles).to contain_exactly("title_rank_standard")
    end
  end

  describe "名乗りとの関係" do
    it "何も名乗っていなければ、位を名乗らせる" do
      subscribe!("standard")
      described_class.call(user: user)

      equipped = UserReward.held.where(user_id: user.id, equipped: true)
      expect(equipped.map { |r| r.reward_definition.key }).to eq([ "title_rank_standard" ])
    end

    # 位は契約に付いてくるもの。本人が選んだ名乗りを奪わない
    it "自分で選んだ名乗りは奪わない" do
      chosen = RewardDefinition.find_by(key: "title_traveler")
      Achievements::Granter.grant(user: user, reward: chosen, source: "manual")
      Achievements::Showcase.star!(UserReward.find_by(user_id: user.id, reward_definition_id: chosen.id))

      subscribe!("standard")
      described_class.call(user: user)

      equipped = UserReward.held.where(user_id: user.id, equipped: true)
      expect(equipped.map { |r| r.reward_definition.key }).to eq([ "title_traveler" ])
    end

    # **同期は何度でも走る**（更新・支払い・便りの再送）。
    # そのたびに名乗り直すと、本人が選んだ「名乗らない」を上書きしてしまう
    it "自分で名乗りを外したら、同期で名乗り直さない" do
      subscribe!("standard")
      described_class.call(user: user)
      reward = UserReward.held.find_by(user_id: user.id, reward_definition_id: rank("standard").id)
      Achievements::Showcase.unstar!(reward)

      described_class.call(user: user)
      described_class.call(user: user)

      expect(reward.reload.equipped).to be(false)
      expect(UserReward.held.where(user_id: user.id, equipped: true)).to be_empty
    end

    # 名乗らせるのは手にした瞬間だけ。契約し直したときは付け直してよい
    it "契約し直して位を取り戻したときは、名乗りが空なら名乗る" do
      sub = subscribe!("standard")
      described_class.call(user: user)
      Achievements::Showcase.unstar!(
        UserReward.held.find_by(user_id: user.id, reward_definition_id: rank("standard").id)
      )
      sub.update!(status: "canceled")
      described_class.call(user: user)
      sub.update!(status: "active")
      described_class.call(user: user)

      equipped = UserReward.held.where(user_id: user.id, equipped: true)
      expect(equipped.map { |r| r.reward_definition.key }).to eq([ "title_rank_standard" ])
    end

    # 外すときは飾りも降ろす。持っていない位を名乗ったままにしない
    it "外れた位は名乗りからも降りる" do
      sub = subscribe!("standard")
      described_class.call(user: user)
      sub.update!(status: "canceled")
      described_class.call(user: user)

      revoked = UserReward.find_by(user_id: user.id, reward_definition_id: rank("standard").id)
      expect(revoked.equipped).to be(false)
      expect(revoked.featured_at).to be_nil
    end
  end

  # 名乗っている最中に位が外れる、という**いちばん危ない並び**。
  # 装備だけが残ると、持っていない位をプロフィールに出し続けることになる
  describe "名乗っている位が外れるとき" do
    let!(:other_title) { RewardDefinition.find_by(key: "title_traveler") }

    before do
      sub = subscribe!("standard")
      described_class.call(user: user)
      # 別の称号も持たせておく。巻き添えで外れないことを確かめるため
      Achievements::Granter.grant(user: user, reward: other_title, source: "manual")
      sub.update!(status: "canceled")
      described_class.call(user: user)
    end

    it "装備も掲示も残さない" do
      revoked = UserReward.find_by(user_id: user.id, reward_definition_id: rank("standard").id)

      expect(revoked.held?).to be(false)
      expect(revoked.equipped).to be(false)
      expect(revoked.featured_at).to be_nil
      expect(revoked.room_placed).to be(false)
    end

    # 画面に出る道は summary（プロフィール・エントランス）。
    # 外れた位がここに残らず、代わりにいまの位（市民）が出ること。
    # **名乗りを空にしない**のは、解約した人のプロフィールから名前が消えないようにするため
    it "外れた位ではなく、いまの位が出る" do
      summary = Achievements::Presenter.summary_only(user: user)

      expect(summary[:title][:key]).to eq("title_rank_free")
      expect(summary[:showcase]["title"].map { |r| r[:key] }).to eq([ "title_rank_free" ])
    end

    it "星の付いた数は1つのまま（外れた位は数えない）" do
      expect(Achievements::Showcase.showcased_count(user, "title")).to eq(1)
    end

    # 位の付け外しで、本人が持っている別の称号まで動かさない
    it "ほかの称号は巻き添えにしない" do
      kept = UserReward.find_by(user_id: user.id, reward_definition_id: other_title.id)

      expect(kept.held?).to be(true)
    end
  end

  describe "所持判定に混ざらない" do
    # revoked_at を足した目的そのもの。手放したものが「持っている」に数えられないこと
    it "外した位は、一覧でも数でも持っていない扱いになる" do
      sub = subscribe!("standard")
      described_class.call(user: user)
      sub.update!(status: "canceled")
      described_class.call(user: user)

      rows = Achievements::Presenter.call(user: user)[:rewards]
      standard = rows.find { |r| r[:key] == "title_rank_standard" }
      expect(standard[:owned]).to be(false)
      expect(standard[:starred]).to be(false)

      counts = Achievements::Presenter.call(user: user)[:summary][:counts]["title"]
      expect(counts[:owned]).to eq(1)
      expect(Achievements::Showcase.showcased_count(user, "title")).to eq(1)
      expect(Achievements::Conditions.value_for("rewards_earned", user)).to eq(1)
    end
  end

  describe "段に位が無いとき" do
    it "引けなければ何も外さない" do
      subscribe!("standard")
      described_class.call(user: user)
      allow(RewardDefinition).to receive(:rank_for_tier).and_return(nil)

      expect { described_class.call(user: user) }.not_to change { held_titles }
    end
  end
end
