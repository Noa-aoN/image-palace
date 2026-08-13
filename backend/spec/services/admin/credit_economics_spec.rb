require "rails_helper"

# クレジットの出入りと、いま抱えているぶん。
#
# 台帳（credit_transactions）を唯一の出どころにする。残高の表から数え直すと、
# 「配った量」と「使われた量」が別の数え方になって合わなくなる。
RSpec.describe "クレジット経済" do
  let(:now) { Time.zone.local(2026, 8, 13, 12) }
  let(:pt) { Billing::POINTS_PER_CREDIT }
  let(:user) { create(:user, :confirmed) }

  def economics(period: "30d")
    travel_to(now) { Admin::BusinessMetricsService.call(now: now, period: period) }[:credit_economics]
  end

  describe "出入り" do
    it "配ったぶん・使ったぶん・失効したぶんを、期間で数える" do
      travel_to(now - 5.days) do
        user.grant_credits!(10 * pt, kind: "campaign", expires_at: now + 1.month)
        user.consume_credits!(4 * pt)
      end

      result = economics

      expect(result[:issued]).to eq(10.0)
      expect(result[:consumed]).to eq(4.0)
      expect(result[:expired]).to eq(0.0)
    end

    it "期間の外の出入りは数えない" do
      travel_to(now - 100.days) { user.grant_credits!(50 * pt, kind: "campaign", expires_at: now + 1.month) }

      expect(economics(period: "30d")[:issued]).to eq(0.0)
      expect(economics(period: "1y")[:issued]).to eq(50.0)
    end

    it "失効は台帳から数える（残高を見に行かない）" do
      travel_to(now - 40.days) { user.grant_credits!(6 * pt, kind: "campaign", expires_at: now - 3.days) }
      travel_to(now - 2.days) { ExpireCreditGrantsJob.perform_now }

      expect(economics[:expired]).to eq(6.0)
    end
  end

  describe "いま抱えているぶん" do
    it "期限切れは数えない（使えないものを「残っている」と書かない）" do
      travel_to(now - 40.days) do
        user.grant_credits!(5 * pt, kind: "campaign", expires_at: now - 1.day)
        user.grant_credits!(3 * pt, kind: "campaign", expires_at: now + 10.days)
      end

      expect(economics[:outstanding]).to eq(3.0)
    end

    it "無料由来と有料由来を分ける" do
      travel_to(now - 3.days) do
        user.grant_credits!(2 * pt, kind: "trial", expires_at: now + 1.month)
        user.grant_credits!(7 * pt, kind: "topup", expires_at: now + 1.month)
      end

      result = economics

      expect(result[:outstanding_free]).to eq(2.0)
      expect(result[:outstanding_paid]).to eq(7.0)
      expect(result[:outstanding]).to eq(9.0)
    end
  end

  describe "期限が近いぶん" do
    it "7日以内・30日以内と、残高に占める割合を返す" do
      travel_to(now - 3.days) do
        user.grant_credits!(4 * pt, kind: "campaign", expires_at: now + 5.days)
        user.grant_credits!(6 * pt, kind: "campaign", expires_at: now + 20.days)
        user.grant_credits!(10 * pt, kind: "campaign", expires_at: now + 80.days)
      end

      expiring = economics[:expiring]

      expect(expiring[:within_7_days]).to eq(4.0)
      expect(expiring[:within_30_days]).to eq(10.0)
      expect(expiring[:share_of_outstanding]).to eq(50.0)
    end
  end

  describe "1クレジットあたりの実原価" do
    before do
      CostParameter.create!(key: "fx_usd_jpy", value: 150)
      CostParameter.create!(key: "image_usd.gpt-image-1.medium", value: 0.04)
    end

    it "AI の変動費を、その期間に使われた枚数で割る" do
      travel_to(now - 2.days) do
        user.grant_credits!(10 * pt, kind: "campaign", expires_at: now + 1.month)
        user.consume_credits!(2 * pt)
        2.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium") }
      end

      # 0.04 * 2 * 150 = 12円 ÷ 2クレジット = 6円
      expect(economics[:cost_per_credit_jpy]).to eq(6.0)
    end

    it "使われた枚数が0なら出さない（割り算ができない）" do
      expect(economics[:cost_per_credit_jpy]).to be_nil
      expect(economics[:estimated_unfulfilled_cost_jpy]).to be_nil
    end

    it "まだ提供していないぶんの原価の見当を出す" do
      travel_to(now - 2.days) do
        user.grant_credits!(10 * pt, kind: "campaign", expires_at: now + 1.month)
        user.consume_credits!(2 * pt)
        2.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium") }
      end

      # 残 8cr × 6円
      expect(economics[:estimated_unfulfilled_cost_jpy]).to eq(48)
    end
  end

  describe "消費 ÷ 発行" do
    it "同じクレジットの追跡ではないので、参考として返すだけ" do
      travel_to(now - 5.days) do
        user.grant_credits!(10 * pt, kind: "campaign", expires_at: now + 1.month)
        user.consume_credits!(5 * pt)
      end

      expect(economics[:consumption_to_issuance]).to eq(50.0)
    end

    it "配っていない期間は出さない（0で割らない）" do
      expect(economics[:consumption_to_issuance]).to be_nil
    end
  end
end
