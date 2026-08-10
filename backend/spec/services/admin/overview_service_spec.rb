require "rails_helper"

RSpec.describe Admin::OverviewService do
  let(:user) { create(:user, :confirmed) }
  let(:overview) { described_class.call }

  describe "未使用クレジット" do
    before do
      # 3つの入れ物すべてに残す。どれか1つでも取りこぼすと総量が合わない
      user.update!(subscription_credits: 500, topup_credits: 200)
      user.credit_grants.create!(kind: "trial", amount_points: 300, remaining_points: 300,
                                 expires_at: 3.months.from_now)
      user.credit_grants.create!(kind: "topup", amount_points: 400, remaining_points: 100,
                                 expires_at: 6.months.from_now)
    end

    it "3つの入れ物をすべて数える" do
      # 500 + 200 + 300 + 100 = 1100pt = 11cr
      expect(overview[:credit_liability][:total]).to eq(11.0)
    end

    it "課金の「未使用クレジット」は、未使用クレジット節と同じ数を返す" do
      # 別々に数え直していたころ、期限付きグラントを取りこぼして食い違っていた
      expect(overview[:billing][:outstanding_credits]).to eq(overview[:credit_liability][:total])
    end

    it "全部使われたら出ていく原価を円で返す" do
      expected = (11.0 * Billing::Catalog::COST_PER_CREDIT).round

      expect(overview[:credit_liability][:total_cost_jpy]).to eq(expected)
    end

    it "出どころごとの内訳を返す" do
      breakdown = overview[:credit_liability][:breakdown]

      expect(breakdown[:subscription]).to eq(5.0)
      expect(breakdown[:topup]).to eq(3.0)  # 古い topup_credits 200 + topup グラント 100
      expect(breakdown[:grant]).to eq(3.0)  # trial 300
    end
  end
end
