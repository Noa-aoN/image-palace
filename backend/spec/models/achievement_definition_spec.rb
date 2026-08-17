# frozen_string_literal: true

require "rails_helper"

RSpec.describe AchievementDefinition do
  describe ".ensure_builtins!" do
    # 組み込みを「作るときだけ」入れていたため、先に作られた行がコードと
    # 食い違ったまま本番で動いていた（実績「100枚のカード」がコードでは
    # クレジット、本番では勲章）。報酬は原価に直結するので、コードを正本にする。
    it "先にある行の報酬を、コードの内容へ揃える" do
      described_class.registry
      row = described_class.find_by(key: "hundred_cards")
      row.update_columns(rewards: [ { "type" => "credits", "amount" => 999 } ]) # rubocop:disable Rails/SkipsModelValidations

      described_class.instance_variable_set(:@builtins_checked, false)
      described_class.ensure_builtins!

      expect(row.reload.rewards).to eq(
        described_class::BUILTINS.find { |b| b[:key] == "hundred_cards" }[:rewards].map(&:stringify_keys)
      )
    end

    it "報酬が同じなら書き込まない（毎回 UPDATE を撃たない）" do
      described_class.registry
      row = described_class.find_by(key: "hundred_cards")
      before = row.updated_at

      described_class.instance_variable_set(:@builtins_checked, false)
      described_class.ensure_builtins!

      expect(row.reload.updated_at).to eq(before)
    end

    it "組み込みが指す獲得物は、すべて実在する" do
      described_class.registry
      MissionDefinition.registry

      keys = (described_class::BUILTINS + MissionDefinition::BUILTINS)
             .flat_map { |b| Array(b[:rewards]) }
             .select { |r| r["type"] == "reward" }
             .map { |r| r["key"] }
             .uniq
      missing = keys - RewardDefinition.where(key: keys).pluck(:key)

      expect(missing).to be_empty
    end
  end
end
