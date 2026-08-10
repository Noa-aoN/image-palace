require "rails_helper"

RSpec.describe Achievements::Evaluator do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { create(:item_type) }

  def make_cards(count)
    count.times { |i| create(:item, user: user, item_type: item_type, title: "語#{i}") }
  end

  def review!(at:, result: "correct")
    ItemReview.create!(user: user, item: create(:item, user: user, item_type: item_type),
                       mode: "quiz", result: result, reviewed_at: at)
  end

  describe "実績" do
    it "条件を満たすと達成になり、報酬が配られる" do
      make_cards(1)

      result = described_class.call(user: user)

      expect(result.completed_achievements.map(&:key)).to include("first_card")
      expect(user.user_rewards.joins(:reward_definition).pluck("reward_definitions.key"))
        .to include("medal_first_card", "title_traveler", "treasure_seed")
    end

    it "届いていなければ進捗だけ記録する" do
      make_cards(3)

      described_class.call(user: user)

      state = UserAchievement.joins(:achievement_definition)
                             .find_by(user_id: user.id, achievement_definitions: { key: "ten_cards" })
      expect(state.progress).to eq(3)
      expect(state.completed_at).to be_nil
    end

    # 何度走らせても同じ結果になること。ページを開くたびに呼ぶので、ここが崩れると二重に配る
    it "二度走らせても二重に配らない" do
      make_cards(1)
      described_class.call(user: user)

      expect { described_class.call(user: user) }.not_to change(UserReward, :count)
    end

    it "一度達成したものは、あとから条件を下回っても外れない" do
      make_cards(1)
      described_class.call(user: user)
      user.items.destroy_all

      described_class.call(user: user)

      state = UserAchievement.joins(:achievement_definition)
                             .find_by(user_id: user.id, achievement_definitions: { key: "first_card" })
      expect(state.completed_at).to be_present
    end

    it "止めた実績は評価しない" do
      AchievementDefinition.registry
      AchievementDefinition.find_by(key: "first_card").update!(enabled: false)
      make_cards(1)

      result = described_class.call(user: user)

      expect(result.completed_achievements.map(&:key)).not_to include("first_card")
    end
  end

  describe "ミッション" do
    # 通算の数で判定すると、既に条件を満たしている人が初日に全部達成してしまう
    it "今日ぶんのミッションは、今日の数だけを見る" do
      MissionDefinition.registry
      mission = MissionDefinition.find_by(key: "daily_one_review")
      review!(at: 3.days.ago)

      described_class.call(user: user)

      state = UserMission.find_by(user_id: user.id, mission_definition_id: mission.id)
      expect(state.progress).to eq(0)
      expect(state.completed_at).to be_nil
    end

    it "今日やれば達成になる" do
      MissionDefinition.registry
      review!(at: Time.current)

      result = described_class.call(user: user)

      expect(result.completed_missions.map(&:key)).to include("daily_one_review")
    end

    # 期間ごとに別の行になるので、毎日全員ぶんを作り直すリセット処理が要らない
    it "日が変われば別の行になる" do
      MissionDefinition.registry
      review!(at: Time.current)
      described_class.call(user: user)

      travel_to(2.days.from_now) { described_class.call(user: user) }

      mission = MissionDefinition.find_by(key: "daily_one_review")
      expect(UserMission.where(user_id: user.id, mission_definition_id: mission.id).count).to eq(2)
    end
  end

  describe "通知" do
    it "獲得・達成のたびに通知を残す" do
      make_cards(1)

      described_class.call(user: user)

      kinds = user.notifications.pluck(:kind).uniq
      expect(kinds).to include("reward_granted", "achievement_completed")
    end

    # 通知の種別が未登録だと静かに落ちる。獲得そのものは取り消さない
    it "通知に失敗しても獲得は残る" do
      allow(Notifications::CreateService).to receive(:call).and_raise(StandardError, "boom")
      make_cards(1)

      expect { described_class.call(user: user) }.to change(UserReward, :count)
    end
  end

  describe "記録" do
    it "評価のあとに数え直される" do
      make_cards(2)

      described_class.call(user: user)

      stat = UserStat.find_by(user_id: user.id)
      expect(stat.cards_created).to eq(2)
      expect(stat.rewards_earned).to eq(user.user_rewards.count)
    end
  end
end
