require "rails_helper"

RSpec.describe GrantPolicy do
  describe ".amount_for" do
    # 何も設定していない状態＝これまでの挙動のまま、が守られていること
    it "行が無ければ Catalog の既定を返す" do
      expect(described_class.amount_for("trial")).to eq(Billing::Catalog::TRIAL_CREDITS)
      expect(described_class.amount_for("monthly_free")).to eq(Billing::Catalog::MONTHLY_FREE_CREDITS)
    end

    it "行があればその値を返す" do
      described_class.create!(key: "trial", amount: 7)

      expect(described_class.amount_for("trial")).to eq(7)
    end

    it "無効なら 0（配らない）" do
      described_class.create!(key: "trial", amount: 7, enabled: false)

      expect(described_class.amount_for("trial")).to eq(0)
    end

    it "知らないキーは 0" do
      expect(described_class.amount_for("unknown")).to eq(0)
    end
  end

  describe "検証" do
    it "アイテムを配るなら種類が要る" do
      policy = described_class.new(key: "welcome_skin", reward_type: "item", amount: 1)

      expect(policy).not_to be_valid
      expect(policy.errors[:item_kind]).to be_present
    end

    # 準備中のアイテムは、無効のままなら設定を保存できる
    it "種類があり無効なら通る" do
      policy = described_class.new(key: "welcome_skin", reward_type: "item", amount: 1, item_kind: "skin", enabled: false)

      expect(policy).to be_valid
    end

    it "準備中の種類は有効にできない" do
      policy = described_class.new(key: "welcome_skin", reward_type: "item", amount: 1, item_kind: "skin", enabled: true)

      expect(policy).not_to be_valid
      expect(policy.errors[:base].join).to include("準備中")
    end

    it "知らない種類は弾く" do
      policy = described_class.new(key: "x", reward_type: "item", amount: 1, item_kind: "dragon")

      expect(policy).not_to be_valid
    end
  end

  describe ".overview" do
    it "未設定のキーも既定値つきで並べる" do
      rows = described_class.overview

      trial = rows.find { |row| row[:key] == "trial" }
      expect(trial[:customized]).to be(false)
      expect(trial[:amount]).to eq(Billing::Catalog::TRIAL_CREDITS)
    end

    it "設定済みは customized になり、既定値も併記する" do
      described_class.create!(key: "trial", amount: 7)

      trial = described_class.overview.find { |row| row[:key] == "trial" }
      expect(trial[:customized]).to be(true)
      expect(trial[:amount]).to eq(7)
      expect(trial[:default_amount]).to eq(Billing::Catalog::TRIAL_CREDITS)
    end
  end
end
