# frozen_string_literal: true

require "rails_helper"

# 運営の仕事のための予算。
#
# 公式の絵を作るのに、**その人の買い物として払わせない**。
# ただし**財布は分けない**。分けていたころは運営の残高が1点も動かず、
#   ・クレジットの数え方が壊れても気づけない（実際、気づけなかった）
#   ・自分がどれだけ使っているかも分からない
# という状態になっていた。
#
# いまは執務室から**自分の残高へ入れる**。入れたあとは普通のクレジットと同じ。
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

  # ここが肝。**運営も、ほかの利用者とまったく同じ道で引かれる**
  describe "使うとき" do
    before do
      [ studio, normal ].each do |user|
        user.ensure_free_credits!
        user.reload
      end
    end

    it "運営でも残高から減る" do
      expect { studio.consume_credits!(one_image) }
        .to change { studio.reload.available_credit_points }.by(-one_image)
    end

    it "残高の履歴に載る（買い物と同じ扱いにする）" do
      expect { studio.consume_credits!(one_image) }.to change(CreditTransaction, :count).by(1)
    end

    it "1点＝0.01クレジットまで動く" do
      studio.credit_grants.destroy_all
      studio.update!(subscription_credits: 300, topup_credits: 0)

      studio.reload.consume_credits!(1)

      expect(studio.reload.available_credits).to eq(2.99)
    end

    it "使っても、入れられる量（枠）は動かない" do
      expect { studio.consume_credits!(one_image) }
        .not_to change { studio.studio_allowance_used_points }
    end

    it "残高が無ければ、運営でも断られる" do
      studio.credit_grants.destroy_all
      studio.update!(subscription_credits: 0, topup_credits: 0)

      expect { studio.reload.consume_credits!(one_image) }.to raise_error(User::InsufficientCredits)
    end

    it "枠を持たない人も、これまでどおり残高から減る" do
      expect { normal.consume_credits!(one_image) }
        .to change { normal.reload.available_credit_points }.by(-one_image)
    end
  end

  describe "入れるとき" do
    it "残高が増える" do
      expect { studio.draw_studio_allowance!(5 * one_image, reason: "公式カードの作成") }
        .to change { studio.reload.available_credit_points }.by(5 * one_image)
    end

    it "出どころが分かる形で入る" do
      studio.draw_studio_allowance!(one_image, reason: "公式カードの作成")
      grant = studio.credit_grants.last

      expect(grant.kind).to eq("ops")
      expect(grant.metadata["reason"]).to eq("公式カードの作成")
      expect(::Billing::CreditLabels.for(grant.kind)).to eq("運営クレジット")
    end

    it "入れたぶんだけ、今月入れられる量が減る" do
      expect { studio.draw_studio_allowance!(3 * one_image, reason: "検証") }
        .to change { studio.studio_allowance_used_points }.by(3 * one_image)
    end

    it "月をまたいで積み上がらないよう、期限を持つ" do
      studio.draw_studio_allowance!(one_image, reason: "検証")

      expect(studio.credit_grants.last.expires_at).to be_present
    end

    it "上限を超えては入れられない" do
      over = studio.studio_allowance_limit_points + 1

      expect { studio.draw_studio_allowance!(over, reason: "使いすぎ") }
        .to raise_error(StudioAllowance::OverAllowance)
      expect(studio.reload.available_credit_points).to eq(0)
    end

    it "枠を持たない人は入れられない" do
      expect { normal.draw_studio_allowance!(one_image, reason: "だめ") }
        .to raise_error(StudioAllowance::OverAllowance)
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
  end

  describe "月ごとに戻る" do
    it "先月入れたぶんは、今月の量に数えない" do
      travel_to(1.month.ago) { studio.draw_studio_allowance!(one_image, reason: "先月") }

      expect(studio.studio_allowance_used_points).to eq(0)
      expect(StudioUsage.count).to eq(1) # 記録そのものは残る
    end
  end

  describe "画面へ渡す形" do
    it "入れた量・上限・残りが分かる" do
      studio.draw_studio_allowance!(one_image, reason: "検証")
      summary = studio.studio_allowance_summary

      expect(summary[:used_credits]).to eq(1.0)
      expect(summary[:limit_credits]).to eq(GrantPolicy.amount_for("studio_allowance").to_f)
      expect(summary[:remaining_credits]).to eq(summary[:limit_credits] - 1.0)
    end

    it "枠を持たない人には出さない" do
      expect(normal.studio_allowance_summary).to be_nil
    end
  end

  describe "退会したとき" do
    it "引き出した記録も一緒に消える" do
      studio.draw_studio_allowance!(one_image, reason: "検証")

      expect { studio.destroy! }.to change(StudioUsage, :count).by(-1)
    end
  end
end
