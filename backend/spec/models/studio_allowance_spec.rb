# frozen_string_literal: true

require "rails_helper"

# 公式コンテンツを作るのに、**買ったクレジットを使わせない**。
# 運営の仕事であって、その人の買い物ではない。
#
# それでも無制限にはしない。間違いや暴走がそのまま費用になるので、
# 「使い切らない大きさ」を置いて、近づいたら気づけるようにする。
RSpec.describe StudioAllowance do
  let(:studio) { create(:user, :confirmed, role: "admin") }
  let(:normal) { create(:user, :confirmed) }
  let(:one_image) { Billing::POINTS_PER_CREDIT }

  describe "誰が持つか" do
    it "公式コンテンツを作れる人だけ" do
      expect(studio.studio_allowance?).to be(true)
      expect(normal.studio_allowance?).to be(false)
      expect(create(:user, :confirmed, role: "operator").studio_allowance?).to be(false)
    end
  end

  describe "枠から使う" do
    before { normal_and_studio_have_credits }

    def normal_and_studio_have_credits
      [ studio, normal ].each do |user|
        user.ensure_free_credits!
        user.reload
      end
    end

    # ここが肝
    it "買ったクレジットが1ポイントも減らない" do
      before_points = studio.available_credit_points

      studio.consume_credits!(one_image)

      expect(studio.reload.available_credit_points).to eq(before_points)
    end

    it "枠のほうが増える" do
      expect { studio.consume_credits!(one_image) }
        .to change { studio.studio_allowance_used_points }.by(one_image)
    end

    it "残高の履歴には載らない（買い物ではないので）" do
      expect { studio.consume_credits!(one_image) }.not_to change(CreditTransaction, :count)
    end

    it "何に使ったかは残る" do
      item = studio.items.create!(title: "見本", item_type: create(:item_type), generation_status: "completed")

      studio.consume_credits!(one_image, item: item, kind: "image")
      usage = StudioUsage.last

      expect(usage.kind).to eq("image")
      expect(usage.item_id).to eq(item.id)
      expect(usage.cost_points).to eq(one_image)
    end

    # 普通の人には何も変わらない
    it "枠を持たない人は、今までどおり残高から減る" do
      expect { normal.consume_credits!(one_image) }
        .to change { normal.reload.available_credit_points }.by(-one_image)
      expect(StudioUsage.count).to eq(0)
    end
  end

  describe "上限" do
    it "既定は付与ポリシーの値" do
      expect(studio.studio_allowance_limit_points)
        .to eq(GrantPolicy.amount_for("studio_allowance") * Billing::POINTS_PER_CREDIT)
    end

    it "運営が変えられる（デプロイ無しで）" do
      GrantPolicy.create!(key: "studio_allowance", reward_type: "credits", amount: 10, enabled: true)

      expect(studio.studio_allowance_limit_points).to eq(10 * Billing::POINTS_PER_CREDIT)
    end

    # **使い切ったら普通のクレジットへ戻る。**
    # 作業が止まるより、気づいてから上げてもらうほうがよい
    it "使い切ったら、普通のクレジットから使う" do
      GrantPolicy.create!(key: "studio_allowance", reward_type: "credits", amount: 1, enabled: true)
      studio.ensure_free_credits!
      studio.reload

      studio.consume_credits!(one_image) # 枠をちょうど使い切る
      expect(studio.studio_allowance_remaining_points).to eq(0)

      before_points = studio.reload.available_credit_points
      studio.consume_credits!(one_image)

      expect(studio.reload.available_credit_points).to eq(before_points - one_image)
    end

    it "残高も枠も足りなければ、今までどおり断る" do
      GrantPolicy.create!(key: "studio_allowance", reward_type: "credits", amount: 0, enabled: true)
      studio.credit_grants.destroy_all
      studio.update!(subscription_credits: 0, topup_credits: 0)

      expect { studio.consume_credits!(one_image) }.to raise_error(User::InsufficientCredits)
    end
  end

  describe "月ごとに戻る" do
    it "先月ぶんは数えない" do
      travel_to(1.month.ago) { studio.consume_credits!(one_image) }

      expect(studio.studio_allowance_used_points).to eq(0)
      expect(StudioUsage.count).to eq(1) # 記録そのものは残る
    end
  end

  describe "画面へ渡す形" do
    it "使った量・上限・残りが分かる" do
      studio.consume_credits!(one_image)
      summary = studio.studio_allowance_summary

      expect(summary[:used_credits]).to eq(1.0)
      expect(summary[:limit_credits]).to eq(GrantPolicy.amount_for("studio_allowance").to_f)
      expect(summary[:remaining_credits]).to eq(summary[:limit_credits] - 1.0)
    end

    it "枠を持たない人には出さない" do
      expect(normal.studio_allowance_summary).to be_nil
    end
  end

  # 原価は別に記録されているので、枠で作ったぶんの費用は今までどおり見える
  describe "原価との関係" do
    it "枠を使っても、原価の記録は別に残る（ここでは触らない）" do
      expect { studio.consume_credits!(one_image) }.not_to change(ImageUsage, :count)
    end
  end

  describe "退会したとき" do
    it "使った記録も一緒に消える" do
      studio.consume_credits!(one_image)

      expect { studio.destroy! }.to change(StudioUsage, :count).by(-1)
    end
  end
end
