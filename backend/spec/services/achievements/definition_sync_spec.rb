# frozen_string_literal: true

require "rails_helper"

# 報酬の定義を変えたときに、**過去の受け取りへ手が伸びていない**ことを見る。
#
# 定義を今のコードへ揃えることと、過去の受取履歴を書き換えることは別の話。
# 前者はしてよいが、後者はしてはならない。
# 混ざると、配り直し・取り上げ・二重付与のどれかが静かに起きる。
RSpec.describe "報酬定義の同期" do
  let(:user) { create(:user, :confirmed) }

  before do
    AchievementDefinition.registry
    MissionDefinition.registry
  end

  def resync!
    AchievementDefinition.instance_variable_set(:@builtins_checked, false)
    MissionDefinition.instance_variable_set(:@builtins_checked, false)
    RewardDefinition.instance_variable_set(:@builtins_checked, false)
    AchievementDefinition.ensure_builtins!
    MissionDefinition.ensure_builtins!
  end

  describe "過去の受け取りに手を出さない" do
    # 「100日続ける」を、昔の中身（30cr）で達成済みにした人を作る
    let(:definition) { AchievementDefinition.find_by(key: "streak_hundred") }

    before do
      definition.update_columns(rewards: [ { "type" => "credits", "amount" => 30 } ]) # rubocop:disable Rails/SkipsModelValidations
      UserAchievement.create!(user: user, achievement_definition: definition,
                              progress: 100, completed_at: 3.days.ago)
      user.grant_credits!(30 * Billing::POINTS_PER_CREDIT, kind: "campaign")
    end

    it "受け取り済みのクレジットを減らさない" do
      before_points = user.credit_transactions.sum(:delta)

      resync!

      expect(user.reload.credit_transactions.sum(:delta)).to eq(before_points)
    end

    it "台帳の行を書き換えない・増やさない" do
      before_rows = user.credit_transactions.order(:created_at).pluck(:id, :kind, :delta)

      resync!

      expect(user.credit_transactions.order(:created_at).pluck(:id, :kind, :delta)).to eq(before_rows)
    end

    it "達成済みの実績に、新しい報酬を後から配らない" do
      resync!
      Achievements::Evaluator.call(user: user)

      # 新しい報酬（勲章）は、達成済みの人には配られない
      expect(user.user_rewards.joins(:reward_definition)
                 .where(reward_definitions: { key: "medal_century_streak" })).to be_empty
      # クレジットも増えない（二重付与にならない）
      expect(user.credit_transactions.count).to eq(1)
    end

    it "達成の記録（いつ達成したか）を書き換えない" do
      state = UserAchievement.find_by(user: user, achievement_definition: definition)
      before_at = state.completed_at

      resync!
      Achievements::Evaluator.call(user: user)

      expect(state.reload.completed_at).to be_within(1.second).of(before_at)
    end
  end

  describe "受け取り済みの獲得物" do
    it "定義から外れた報酬でも、持っているものは取り上げない" do
      reward = RewardDefinition.find_by(key: "medal_laurel")
      owned = Achievements::Granter.grant(user: user, reward: reward, source: "achievement",
                                          source_ref: "old_achievement")
      expect(owned).to be_present

      # 「もう配らない」定義に変えても、持ち物はそのまま
      AchievementDefinition.find_by(key: "hundred_cards").update_columns(rewards: []) # rubocop:disable Rails/SkipsModelValidations
      resync!

      expect(user.user_rewards.joins(:reward_definition)
                 .where(reward_definitions: { key: "medal_laurel" }).count).to eq(1)
    end
  end

  describe "何度流しても同じところに落ち着く" do
    it "定義の数が増えない（実績・ミッション・獲得物）" do
      counts = -> { [ RewardDefinition.count, AchievementDefinition.count, MissionDefinition.count ] }
      before_counts = counts.call

      3.times { resync! }

      expect(counts.call).to eq(before_counts)
    end

    it "鍵が重複しない" do
      3.times { resync! }

      [ RewardDefinition, AchievementDefinition, MissionDefinition ].each do |klass|
        keys = klass.pluck(:key)
        expect(keys.uniq.size).to eq(keys.size), "#{klass} の鍵が重複"
      end
    end

    it "ミッションとシリーズの結び付きが変わらない" do
      before_links = MissionDefinition.order(:key).pluck(:key, :mission_series_id)

      3.times { resync! }

      expect(MissionDefinition.order(:key).pluck(:key, :mission_series_id)).to eq(before_links)
      expect(MissionSeries.pluck(:key).uniq.size).to eq(MissionSeries.count)
    end

    it "報酬の中身がコードと一致した状態へ収束する" do
      3.times { resync! }

      AchievementDefinition::BUILTINS.each do |attrs|
        row = AchievementDefinition.find_by(key: attrs[:key])
        expect(row.rewards.to_a.map(&:stringify_keys)).to eq(Array(attrs[:rewards]).map(&:stringify_keys)),
                                                          "#{attrs[:key]} の報酬がずれている"
      end
    end
  end

  describe "報酬の変更・削除・追加" do
    let(:definition) { AchievementDefinition.find_by(key: "ten_cards") }
    let(:expected) do
      AchievementDefinition::BUILTINS.find { |b| b[:key] == "ten_cards" }[:rewards].map(&:stringify_keys)
    end

    it "中身が変わっていたら、コードへ戻す" do
      definition.update_columns(rewards: [ { "type" => "credits", "amount" => 999 } ]) # rubocop:disable Rails/SkipsModelValidations

      resync!

      expect(definition.reload.rewards).to eq(expected)
    end

    it "消えていたら、コードのぶんを入れ直す" do
      definition.update_columns(rewards: []) # rubocop:disable Rails/SkipsModelValidations

      resync!

      expect(definition.reload.rewards).to eq(expected)
    end

    it "余計に足されていたら、コードのぶんだけに戻す" do
      definition.update_columns(rewards: expected + [ { "type" => "credits", "amount" => 5 } ]) # rubocop:disable Rails/SkipsModelValidations

      resync!

      expect(definition.reload.rewards).to eq(expected)
    end
  end
end
