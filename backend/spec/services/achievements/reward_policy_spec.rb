# frozen_string_literal: true

require "rails_helper"

# 実績・ミッションの報酬は原価に直結する。
#
# **1人あたりが小さくても、人数ぶんそのまま効く。** 利用者が万の桁に乗ったとき、
# 「払わずに届く場所」から出ているクレジットは、そのまま持ち出しになる。
# 気づける場所が本番の請求書しか無いので、ここで先に落とす。
RSpec.describe Achievements::RewardPolicy do
  # 1クレジットあたりの原価の見立て（Billing::Catalog::COST_PER_CREDIT）で換算する
  def yen(credits)
    (credits * Billing::Catalog::COST_PER_CREDIT).round
  end

  describe "決まり" do
    it "クレジットを使わずに満たせる条件では、いくらでも配れない" do
      expect(described_class.credit_backed?("reviews_total")).to be false
      expect(described_class.credit_backed?("streak_days")).to be false
      expect(described_class.credit_backed?("active_days")).to be false
      expect(described_class.credit_backed?("containers_created")).to be false
      expect(described_class.credit_backed?("rewards_earned")).to be false
    end

    it "カード作成と画像生成だけが、クレジットを返してよい条件" do
      expect(described_class.credit_backed?("cards_created")).to be true
      expect(described_class.credit_backed?("images_generated")).to be true
    end
  end

  describe "組み込みの定義" do
    # 定義そのもの（DB へ入る前）を、行と同じ形で読めるようにする
    def rows(builtins)
      builtins.map do |b|
        Struct.new(:key, :condition_type, :condition_target, :rewards)
              .new(b[:key], b[:condition_type], b[:condition_target], b[:rewards])
      end
    end

    let(:achievements) { rows(AchievementDefinition::BUILTINS) }
    let(:missions) { rows(MissionDefinition::BUILTINS) }

    it "実績が決まりを破っていない" do
      expect(described_class.violations(achievements)).to be_empty
    end

    it "ミッションはクレジットを配らない（同じ条件の実績と二重になる）" do
      granting = missions.select { |m| described_class.credit_amount(m).positive? }

      expect(granting.map(&:key)).to be_empty
    end

    it "1人が受け取りうるクレジットの総額が、原価で1000円を超えない" do
      total = (achievements + missions).sum { |d| described_class.credit_amount(d) }

      # 60cr = 540円。ここを超えるときは、条件と量の両方を見直すこと。
      # 数万人が全部取った場合の上限（総額 × 人数）が、そのまま持ち出しになる
      expect(yen(total)).to be <= 1_000
    end

    it "クレジットを配る実績は、その枚数ぶんを既に払っている人にしか届かない" do
      paying = (achievements + missions).select { |d| described_class.credit_amount(d).positive? }

      expect(paying).not_to be_empty
      paying.each do |definition|
        # 条件を満たすまでに払うクレジット（1枚 = 1クレジット）
        spent = definition.condition_target
        refunded = described_class.credit_amount(definition)

        expect(described_class.credit_backed?(definition.condition_type)).to be(true),
                                                                             "#{definition.key} は払わずに届く"
        expect(refunded).to be <= spent * described_class::MAX_REFUND_RATE
      end
    end
  end

  describe "DB の行" do
    it "組み込みを取り込んだあとも、決まりを破っていない" do
      AchievementDefinition.registry
      MissionDefinition.registry

      violations = described_class.violations(AchievementDefinition.all + MissionDefinition.all)

      expect(violations).to be_empty
    end
  end
end
