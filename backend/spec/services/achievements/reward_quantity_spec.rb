require "rails_helper"

# 宝物は同じものを複数持てる。称号・勲章・表彰は1つだけ。
#
# **「正しい複数付与」と「再送による二重付与」を混同しない**のが要。
# 数量だけを見ていると、この2つは区別が付かない。
RSpec.describe "宝物の複数所持", type: :model do
  let(:user) { create(:user, :confirmed) }

  def define_reward(kind:, key: "k_#{SecureRandom.hex(3)}")
    RewardDefinition.create!(key: key, kind: kind, name: "確認用#{kind}", rarity_level: 2)
  end

  def grant(reward, event_key: nil, source: "achievement", source_ref: nil)
    Achievements::Granter.grant(
      user: user, reward: reward, source: source, source_ref: source_ref,
      notify: false, event_key: event_key
    )
  end

  describe "重ねて持てるもの（宝物）" do
    let(:treasure) { define_reward(kind: "treasure") }

    it "初めて受け取ると1個" do
      grant(treasure, event_key: "e1")

      owned = UserReward.find_by(user: user, reward_definition: treasure)
      expect(owned.quantity).to eq(1)
      expect(owned.first_acquired_at).to be_present
      expect(owned.last_acquired_at).to eq(owned.first_acquired_at)
    end

    # ここが今回の要。別の出来事なら重なる
    it "別の出来事で受け取ると増える" do
      grant(treasure, event_key: "e1")
      grant(treasure, event_key: "e2")

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(2)
    end

    it "行は増やさない（1人1定義1行のまま）" do
      grant(treasure, event_key: "e1")

      expect { grant(treasure, event_key: "e2") }
        .not_to change { UserReward.where(user: user, reward_definition: treasure).count }
    end

    it "最後に受け取った時刻だけが動く（初回はそのまま）" do
      grant(treasure, event_key: "e1")
      owned = UserReward.find_by(user: user, reward_definition: treasure)
      first = owned.first_acquired_at

      travel_to(2.days.from_now) { grant(treasure, event_key: "e2") }

      owned.reload
      expect(owned.first_acquired_at).to eq(first)
      expect(owned.last_acquired_at).to be > first
    end
  end

  describe "同じ出来事から2回来たとき（再送）" do
    let(:treasure) { define_reward(kind: "treasure") }

    it "増やさない" do
      grant(treasure, event_key: "same-event")
      grant(treasure, event_key: "same-event")

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(1)
    end

    it "受け取りの記録も1件だけ" do
      2.times { grant(treasure, event_key: "same-event") }

      expect(UserRewardGrant.where(user: user, reward_definition: treasure).count).to eq(1)
    end

    it "2回目は nil を返す（配っていないことが呼び出し側に分かる）" do
      grant(treasure, event_key: "same-event")

      expect(grant(treasure, event_key: "same-event")).to be_nil
    end
  end

  describe "重ねられないもの（称号・勲章・表彰）" do
    %w[title medal honor].each do |kind|
      it "#{kind} は別の出来事で来ても増えない" do
        reward = define_reward(kind: kind)
        grant(reward, event_key: "e1")
        grant(reward, event_key: "e2")

        expect(UserReward.find_by(user: user, reward_definition: reward).quantity).to eq(1)
      end
    end

    it "2つ目は配らない（nil を返す）" do
      reward = define_reward(kind: "title")
      grant(reward, event_key: "e1")

      expect(grant(reward, event_key: "e2")).to be_nil
    end
  end

  # 外側のトランザクションの中から呼ばれることがある（まとめて配る処理など）。
  # 重複でここが失敗したときに**外側ごと壊す**と、印を付けるだけのつもりが
  # 呼び出し側の仕事を巻き添えにする
  describe "外側のトランザクションの中から呼ばれたとき" do
    let(:treasure) { define_reward(kind: "treasure") }

    it "同じ出来事が2回来ても、外側の取引を壊さない" do
      expect {
        ActiveRecord::Base.transaction do
          grant(treasure, event_key: "same")
          grant(treasure, event_key: "same") # 2回目。ここで外側を壊してはいけない
          # 壊れていれば、この問い合わせで PG::InFailedSqlTransaction になる
          User.where(id: user.id).count
        end
      }.not_to raise_error

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(1)
    end
  end

  # 理由（source_ref）と鍵（event_key）は役割が違う。
  # 理由や時刻を鍵の代わりにすると、冪等の根拠にならない
  describe "手で配るときの鍵" do
    let(:treasure) { define_reward(kind: "treasure") }

    it "同じ理由で2回配れば、2個になる（理由は鍵ではない）" do
      Achievements::Granter.grant(user: user, reward: treasure, source: "manual",
                                  source_ref: "不具合のお詫び", notify: false)
      Achievements::Granter.grant(user: user, reward: treasure, source: "manual",
                                  source_ref: "不具合のお詫び", notify: false)

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(2)
    end

    it "同じ秒に2回配っても、別の出来事として扱う（時刻は鍵ではない）" do
      travel_to(Time.zone.local(2026, 8, 13, 12, 0, 0)) do
        2.times do
          Achievements::Granter.grant(user: user, reward: treasure, source: "manual",
                                      source_ref: "配布", notify: false)
        end
      end

      expect(UserRewardGrant.where(user: user, reward_definition: treasure).count).to eq(2)
    end

    it "呼び出し側が鍵を渡せば、そちらで冪等になる" do
      2.times do
        Achievements::Granter.grant(user: user, reward: treasure, source: "manual",
                                    source_ref: "配布", notify: false, event_key: "admin:grant:fixed")
      end

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(1)
    end
  end

  describe "受け取りの履歴" do
    let(:treasure) { define_reward(kind: "treasure") }

    it "受け取るたびに1件ずつ残る" do
      grant(treasure, event_key: "e1", source: "achievement", source_ref: "first_card")
      grant(treasure, event_key: "e2", source: "manual", source_ref: "お詫び")

      grants = UserRewardGrant.where(user: user, reward_definition: treasure).recent
      expect(grants.map(&:source)).to eq(%w[manual achievement])
      expect(grants.map(&:source_ref)).to include("お詫び", "first_card")
    end
  end

  describe "実績からの付与" do
    it "同じ実績を2回評価しても、宝物は1個のまま" do
      treasure = define_reward(kind: "treasure", key: "t_ach")
      rewards = [ { "type" => "reward", "key" => treasure.key } ]

      2.times do
        Achievements::Granter.grant_rewards(
          user: user, rewards: rewards, source: "achievement", source_ref: "same_achievement"
        )
      end

      expect(UserReward.find_by(user: user, reward_definition: treasure).quantity).to eq(1)
    end
  end
end
