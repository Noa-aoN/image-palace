# frozen_string_literal: true

require "rails_helper"

# 実績の報酬を付け替えたとき、すでに達成している人へ配り直す。
#
# 評価器は達成済みの実績を触らない。正しい振る舞いだが、報酬の付け替えと
# 組み合わせると「その層には永久に配られない」状態になる。ここはその穴を埋める。
#
# **何度走らせても増えない**ことが要。過去の状態を調べずに走らせられる根拠になる。
RSpec.describe Achievements::BackfillAchievementReward do
  let(:medal) { RewardDefinition.create!(key: "medal_x", kind: "medal", name: "確認用勲章", rarity_level: 2) }

  let(:achievement) do
    AchievementDefinition.create!(
      key: "hundred_x", name: "100枚", category: "作成", position: 1,
      condition_type: "cards_created", condition_target: 100,
      rewards: [ { "type" => "reward", "key" => medal.key } ]
    )
  end

  def complete(user, definition: achievement, at: 1.day.ago)
    UserAchievement.create!(user: user, achievement_definition: definition, progress: 100, completed_at: at)
  end

  def backfill(dry_run: false)
    described_class.call(achievement_key: achievement.key, reward_key: medal.key, dry_run: dry_run)
  end

  describe "達成済みで持っていない人" do
    let!(:user) { create(:user, :confirmed) }

    before { complete(user) }

    it "配る" do
      expect { backfill }.to change { UserReward.where(user: user, reward_definition: medal).count }.by(1)
    end

    it "配った数を返す" do
      result = backfill

      expect(result.completed).to eq(1)
      expect(result.already_had).to eq(0)
      expect(result.granted).to eq(1)
    end

    # ここが本題。二重に配らない
    it "2回走らせても増えない" do
      backfill

      expect { backfill }.not_to change { UserReward.where(user: user, reward_definition: medal).count }
    end

    it "2回目は対象に数えない（すでに持っている側へ回る）" do
      backfill

      expect(backfill.already_had).to eq(1)
    end
  end

  describe "まだ達成していない人" do
    let!(:user) { create(:user, :confirmed) }

    before { UserAchievement.create!(user: user, achievement_definition: achievement, progress: 40) }

    it "配らない" do
      expect { backfill }.not_to change(UserReward, :count)
    end
  end

  describe "すでに別の実績から同じ勲章を受け取っている人" do
    let!(:user) { create(:user, :confirmed) }

    before do
      complete(user)
      Achievements::Granter.grant(
        user: user, reward: medal, source: "achievement", source_ref: "five_hundred_x",
        notify: false, event_key: "achievement:five_hundred_x:#{medal.key}"
      )
    end

    it "配らない（勲章は重ねて持てない）" do
      expect { backfill }.not_to change { UserReward.where(user: user, reward_definition: medal).count }
    end
  end

  # 自分で外したものを、配り直しで勝手に戻さない
  describe "一度受け取って手放した人" do
    let!(:user) { create(:user, :confirmed) }

    before do
      complete(user)
      Achievements::Granter.grant(user: user, reward: medal, source: "achievement",
                                  source_ref: achievement.key, notify: false)
      UserReward.find_by(user: user, reward_definition: medal).update!(revoked_at: Time.current)
    end

    it "持ち直させない" do
      backfill

      expect(UserReward.find_by(user: user, reward_definition: medal).revoked_at).to be_present
    end

    it "「すでに持っている」に数える" do
      expect(backfill.already_had).to eq(1)
    end
  end

  describe "dry_run" do
    let!(:user) { create(:user, :confirmed) }

    before { complete(user) }

    it "配らない" do
      expect { backfill(dry_run: true) }.not_to change(UserReward, :count)
    end

    it "対象の人数は数える" do
      result = backfill(dry_run: true)

      expect(result.completed).to eq(1)
      expect(result.granted).to eq(0)
    end
  end

  describe "指定が間違っているとき" do
    it "実績が無ければ止まる" do
      expect { described_class.call(achievement_key: "no_such", reward_key: medal.key) }
        .to raise_error(described_class::MissingDefinition, /no_such/)
    end

    it "獲得物が無ければ止まる" do
      expect { described_class.call(achievement_key: achievement.key, reward_key: "no_such") }
        .to raise_error(described_class::MissingDefinition, /no_such/)
    end
  end
end
