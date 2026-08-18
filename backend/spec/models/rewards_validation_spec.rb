# frozen_string_literal: true

require "rails_helper"

# クレジットの決まり（Achievements::RewardPolicy）は、組み込みの定義でしか
# 守られていなかった。運営が画面から作る行には効いておらず、
# 「払わずに届く条件」へクレジットを置ける状態だった。
#
# ミッションには報酬の検証が1つも無く、存在しない獲得物も指せた。
# **片方にしか付けないと、付いていない側が抜け道になる。**
RSpec.describe RewardsValidation do
  let(:medal) { RewardDefinition.create!(key: "medal_y", kind: "medal", name: "確認用勲章", rarity_level: 2) }

  def achievement(condition_type:, condition_target:, rewards:)
    AchievementDefinition.new(
      key: "a_#{SecureRandom.hex(3)}", name: "確認用", category: "作成", position: 90,
      condition_type: condition_type, condition_target: condition_target, rewards: rewards
    )
  end

  def mission(condition_type:, condition_target:, rewards:)
    MissionDefinition.new(
      key: "m_#{SecureRandom.hex(3)}", name: "確認用", cadence: "daily", position: 90,
      condition_type: condition_type, condition_target: condition_target, rewards: rewards
    )
  end

  describe "クレジットを配れない条件" do
    it "実績では弾く（続けるだけで届く条件に、クレジットは出さない）" do
      record = achievement(condition_type: "streak_days", condition_target: 7,
                           rewards: [ { "type" => "credits", "amount" => 50 } ])

      expect(record).not_to be_valid
      expect(record.errors[:rewards].join).to include("クレジットは配れません")
    end

    it "ミッションでも弾く" do
      record = mission(condition_type: "reviews_total", condition_target: 5,
                       rewards: [ { "type" => "credits", "amount" => 3 } ])

      expect(record).not_to be_valid
      expect(record.errors[:rewards].join).to include("クレジットは配れません")
    end
  end

  describe "クレジットを配れる条件" do
    it "上限内なら通す（1000枚に10cr = 1%）" do
      record = achievement(condition_type: "cards_created", condition_target: 1_000,
                           rewards: [ { "type" => "credits", "amount" => 10 } ])

      expect(record).to be_valid
    end

    it "上限を超えたら弾く" do
      record = achievement(condition_type: "cards_created", condition_target: 1_000,
                           rewards: [ { "type" => "credits", "amount" => 11 } ])

      expect(record).not_to be_valid
      expect(record.errors[:rewards].join).to include("上限")
    end
  end

  describe "獲得物の指定" do
    it "実在するものなら通す" do
      expect(achievement(condition_type: "streak_days", condition_target: 7,
                         rewards: [ { "type" => "reward", "key" => medal.key } ])).to be_valid
    end

    it "ミッションでも、無い獲得物は弾く（これまで素通りしていた）" do
      record = mission(condition_type: "streak_days", condition_target: 3,
                       rewards: [ { "type" => "reward", "key" => "no_such_reward" } ])

      expect(record).not_to be_valid
      expect(record.errors[:rewards].join).to include("無い獲得物")
    end
  end

  # 組み込みは update_columns で書き戻すため検証を通らないが、
  # 新しい環境では create! で作られる。決まりに反していれば seed が落ちる
  describe "組み込みの定義" do
    it "実績・ミッションともに決まりを守っている" do
      AchievementDefinition.registry
      MissionDefinition.registry

      violations = Achievements::RewardPolicy.violations(
        AchievementDefinition.all.to_a + MissionDefinition.all.to_a
      )

      expect(violations).to be_empty
    end
  end
end
