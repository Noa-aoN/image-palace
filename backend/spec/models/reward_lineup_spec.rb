require "rails_helper"

# 獲得物の品揃え。
#
# **数と配る道が揃っていないと、埋まらない枠が並ぶ。**
# 定義だけ増やして条件を用意し忘れると、一覧に「取れないもの」が残る。
RSpec.describe "獲得物の品揃え" do
  let(:rewards) { RewardDefinition::BUILTINS }
  let(:achievements) { AchievementDefinition::BUILTINS }

  def keys_of(kind) = rewards.select { |r| r[:kind] == kind }.map { |r| r[:key] }

  describe "数" do
    it "称号・勲章は12ずつ、宝物は18、表彰は5" do
      expect(keys_of("title").size).to eq(12)
      expect(keys_of("medal").size).to eq(12)
      expect(keys_of("treasure").size).to eq(18)
      expect(keys_of("honor").size).to eq(5)
    end

    it "鍵が重複していない" do
      keys = rewards.map { |r| r[:key] }

      expect(keys.uniq.size).to eq(keys.size)
    end

    it "同じ種別の中で並び順が重複していない（どちらが先か決まらない）" do
      RewardDefinition::KINDS.each do |kind|
        positions = rewards.select { |r| r[:kind] == kind }.map { |r| r[:position] }

        expect(positions.uniq.size).to eq(positions.size), "#{kind} の position が重複"
      end
    end
  end

  describe "配る道" do
    let(:granted) do
      achievements.flat_map { |a| Array(a[:rewards]) }
                  .select { |r| r["type"] == "reward" }.map { |r| r["key"] }
    end

    it "表彰以外は、すべて実績から配られる（取れないものを並べない）" do
      earnable = rewards.reject { |r| r[:kind] == "honor" }.map { |r| r[:key] }

      expect(earnable - granted).to be_empty
    end

    # 表彰は運営が手で贈るもの。条件では配らない
    it "表彰は実績から配らない" do
      expect(granted & keys_of("honor")).to be_empty
    end

    it "実績が指す獲得物は、すべて定義されている" do
      expect(granted.uniq - rewards.map { |r| r[:key] }).to be_empty
    end

    it "同じ目標値の実績を、同じ条件で二重に置かない" do
      pairs = achievements.map { |a| [ a[:condition_type], a[:condition_target] ] }
      duplicated = pairs.tally.select { |_, n| n > 1 }.keys

      # のべ365日だけは、クレジットと勲章で別々に置いてある既存の並び
      expect(duplicated).to eq([ [ "active_days", 365 ] ])
    end
  end

  describe "段" do
    it "条件で配るものは7段まで（8・9は表彰のために空けておく）" do
      levels = rewards.reject { |r| r[:kind] == "honor" }.map { |r| r[:rarity_level] }

      expect(levels.max).to be <= 7
    end

    it "運営だけのものは、表彰の中にだけある" do
      admin_only = rewards.select { |r| r[:admin_only] }

      expect(admin_only.map { |r| r[:key] }).to eq([ "honor_archon" ])
      expect(admin_only.map { |r| r[:kind] }).to eq([ "honor" ])
    end
  end

  describe "絵の指示" do
    it "すべての獲得物が、絵のもとになる言葉を持つ" do
      missing = rewards.reject { |r| r.dig(:metadata, "motif").present? }

      expect(missing.map { |r| r[:key] }).to be_empty
    end
  end
end
