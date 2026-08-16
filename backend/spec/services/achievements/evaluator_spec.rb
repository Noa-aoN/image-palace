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

  # 定義が増えても問い合わせが増えないことを見張る。
  #
  # 定義ごとに数え直していたころは、本番で 144 本・約17秒かかっていた
  # （DB は片道70ms のところにある）。同じ数を数え直さない・行はまとめて読む、
  # のどちらが壊れてもここで落ちる
  describe "問い合わせの本数" do
    def count_queries
      n = 0
      sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
        n += 1 unless payload[:name].to_s.match?(/SCHEMA|TRANSACTION/)
      end
      yield
      n
    ensure
      ActiveSupport::Notifications.unsubscribe(sub)
    end

    it "実績の定義を増やしても本数は変わらない" do
      make_cards(1)
      described_class.call(user: user) # 行を作る回は数えない

      before = count_queries { described_class.call(user: user) }

      base = AchievementDefinition.registry.first
      5.times do |i|
        AchievementDefinition.create!(
          key: "extra_#{i}", name: "追加#{i}", condition_type: "cards_created",
          condition_target: 999, published: true, category: base.category, position: 900 + i
        )
      end
      described_class.call(user: user) # 増えたぶんの行を作る

      after = count_queries { described_class.call(user: user) }

      expect(after).to eq(before)
    end
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

  describe "画面に出す形" do
    it "称号が無い人には、次に取れる称号を出す" do
      RewardDefinition.registry
      described_class.call(user: user)

      summary = Achievements::Presenter.summary_only(user: user)

      expect(summary[:title]).to be_nil
      expect(summary[:next_title][:name]).to eq("記憶の旅人")
    end

    # 星の入り切りは1つの操作。種別ごとの持ち方の違いはサーバー側で畳む
    it "星を入れると、軽い読み出しにも出る" do
      make_cards(1)
      described_class.call(user: user)
      held = UserReward.joins(:reward_definition)
                       .find_by(user_id: user.id, reward_definitions: { key: "title_traveler" })
      Achievements::Showcase.toggle!(user: user, user_reward: held)

      summary = Achievements::Presenter.summary_only(user: user)

      expect(summary[:title][:name]).to eq("記憶の旅人")
      expect(summary[:next_title]).to be_nil
      expect(summary[:showcase]["title"].map { |r| r[:key] }).to eq([ "title_traveler" ])
    end

    # 並べすぎると1つ1つが目に入らない。上限に達したら古いものと入れ替える
    it "掲げる数は種別ごとの上限で打ち切る" do
      RewardDefinition.registry
      medals = RewardDefinition.of_kind("medal").ordered.to_a
      medals.each { |m| UserReward.create!(user: user, reward_definition: m, granted_at: Time.current) }
      medals.each_with_index do |m, i|
        held = UserReward.find_by(user_id: user.id, reward_definition_id: m.id)
        travel_to(Time.current + i.minutes) { Achievements::Showcase.toggle!(user: user, user_reward: held) }
      end

      starred = Achievements::Presenter.summary_only(user: user)[:showcase]["medal"]

      expect(starred.size).to eq(Achievements::Showcase::LIMITS["medal"])
    end

    # 未獲得のものに「どうすれば手に入るか」が無いと、欲しいと思っても動けない
    it "未獲得の獲得物に手に入れ方と進捗を添える" do
      make_cards(3)
      described_class.call(user: user)

      row = Achievements::Presenter.call(user: user)[:rewards].find { |r| r[:key] == "treasure_cup" }

      expect(row[:owned]).to be(false)
      expect(row[:condition]).to eq("カードを10枚作る")
      expect(row[:progress]).to eq(3)
      expect(row[:target]).to eq(10)
    end

    # 序盤で高い段を配ると、続けた人に渡すものが無くなる
    it "レア度は到達の遠さに合わせてある" do
      RewardDefinition.registry

      rows = Achievements::Presenter.call(user: user)[:rewards].index_by { |r| r[:key] }

      expect(rows["title_traveler"][:rarity_level]).to eq(1)
      expect(rows["medal_laurel"][:rarity_level]).to eq(5)
      # 条件で配るものは 7 まで。**8・9 は表彰と位だけに使う**
      # （どちらも積み上げでは届かない。表彰は運営が贈るもの、位は契約に付くもの）
      earned_by_condition = rows.values.reject { |r| r[:kind] == "honor" || r[:plan_rank] }
      expect(earned_by_condition.map { |r| r[:rarity_level] }.max).to be <= 7
    end

    # 取れないものが並ぶと、埋まらない枠として残り続ける
    it "運営だけの表彰は、運営でない人の一覧に出さない" do
      RewardDefinition.registry

      keys = Achievements::Presenter.call(user: user)[:rewards].map { |r| r[:key] }

      expect(keys).not_to include("honor_archon")
      expect(keys).to include("honor_alpha")
    end

    it "運営には出す" do
      RewardDefinition.registry
      admin = create(:user, :confirmed, role: "admin")

      keys = Achievements::Presenter.call(user: admin)[:rewards].map { |r| r[:key] }

      expect(keys).to include("honor_archon")
    end
  end
end
