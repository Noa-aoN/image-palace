require "rails_helper"

# クレジットの期限。**利用規約と食い違わせない。**
#
# 第4条の6 で「付与された日から6ヶ月間」と約束している。
# お試し・毎月分・買い切り・プラン付与のいずれも同じ扱い。
#
# ここは金額に直結する。code と規約のどちらかを直したときに、
# もう一方を直し忘れたことを、この spec で気づけるようにする。
RSpec.describe "クレジットの期限", type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "約束している長さ" do
    # 前払式支払手段は「6ヶ月以内に限り使えるもの」なら規制の適用除外に入りやすい。
    # ここを伸ばすと、規約の改定だけでは済まなくなる
    it "6ヶ月を超えない" do
      expect(Billing::Catalog::CREDIT_LIFETIME).to be <= 6.months
    end

    it "短くしすぎない（使い切れないと、割引が見せかけになる）" do
      expect(Billing::Catalog::CREDIT_LIFETIME).to be >= 3.months
    end
  end

  describe "付与ごとの期限" do
    it "お試しは付与から6ヶ月" do
      travel_to(Time.zone.local(2026, 8, 13, 12)) do
        user.grant_credits!(300, kind: "trial", expires_at: Billing::Catalog::CREDIT_LIFETIME.from_now)

        expect(user.credit_grants.find_by(kind: "trial").expires_at)
          .to be_within(1.minute).of(Time.zone.local(2027, 2, 13, 12))
      end
    end

    it "買い切りは付与から6ヶ月" do
      plan = create(:plan, :topup)

      travel_to(Time.zone.local(2026, 8, 13, 12)) do
        user.add_topup_credits!(plan.credits_per_period * Billing::POINTS_PER_CREDIT)

        expect(user.credit_grants.find_by(kind: "topup").expires_at)
          .to be_within(1.minute).of(Time.zone.local(2027, 2, 13, 12))
      end
    end

    # 当月ぶんは subscription_credits に1ヶ月だけ居てから、期限つきの持ち越しへ移る。
    # 「寿命 − 1ヶ月」にしてあるのは、**届いた日から数えて6ヶ月**にするため。
    # ここを 6ヶ月にすると、実際には7ヶ月使えることになり、規約と食い違う
    it "プランの使い残しは、届いた日から数えて6ヶ月に収まる" do
      granted_at = Time.zone.local(2026, 8, 13, 12)

      travel_to(granted_at) { user.update!(subscription_credits: 500) }
      travel_to(granted_at + 1.month) { user.send(:carry_over_subscription_credits!) }

      carryover = user.credit_grants.find_by(kind: "subscription_carryover")
      expect(carryover.expires_at).to be <= granted_at + 6.months + 1.day
    end
  end

  describe "期限切れの扱い" do
    it "期限を過ぎたぶんは残高に数えない" do
      user.grant_credits!(500, kind: "campaign", expires_at: 1.day.from_now)
      user.grant_credits!(400, kind: "campaign", expires_at: 1.day.ago)

      expect(user.available_credit_points).to eq(500)
    end

    it "期限の近いものから先に使う（規約どおり）" do
      user.grant_credits!(100, kind: "campaign", expires_at: 10.days.from_now)
      user.grant_credits!(100, kind: "campaign", expires_at: 2.days.from_now)

      user.consume_credits!(100)

      near = user.credit_grants.order(:expires_at).first
      far = user.credit_grants.order(:expires_at).last
      expect(near.remaining_points).to eq(0)
      expect(far.remaining_points).to eq(100)
    end

    it "期限が無いものは、期限のあるものより後に使う" do
      user.grant_credits!(100, kind: "campaign", expires_at: nil)
      user.grant_credits!(100, kind: "campaign", expires_at: 5.days.from_now)

      user.consume_credits!(100)

      expect(user.credit_grants.find_by(expires_at: nil).remaining_points).to eq(100)
    end
  end

  describe "残高の合計" do
    # 画面に出る数と、実際に使える量が食い違うと、支払いの話ができなくなる
    it "期限内のグラント＋当月分＋古い買い切りの合計になる" do
      user.grant_credits!(300, kind: "trial", expires_at: 1.month.from_now)
      user.grant_credits!(200, kind: "campaign", expires_at: 1.day.ago) # 期限切れ
      user.update!(subscription_credits: 500, topup_credits: 100)

      expect(user.available_credit_points).to eq(300 + 500 + 100)
    end

    it "使った分だけ減る（増えも減りもしすぎない）" do
      user.grant_credits!(300, kind: "trial", expires_at: 1.month.from_now)
      user.update!(subscription_credits: 200)

      expect { user.consume_credits!(400) }
        .to change { user.reload.available_credit_points }.from(500).to(100)
    end

    it "足りなければ消費しない（残高が負にならない）" do
      user.grant_credits!(100, kind: "trial", expires_at: 1.month.from_now)

      expect { user.consume_credits!(200) }
        .to raise_error(User::InsufficientCredits)
      expect(user.reload.available_credit_points).to eq(100)
    end
  end
end
