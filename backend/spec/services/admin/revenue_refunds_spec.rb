require "rails_helper"

# 売上・返金・手元に残った額を分けて出す。
#
# **Gross の意味は変えない。** 既に読んでいる数字が後から別物になると、
# 経営の判断そのものが揺らぐ。返金は別枠で足す。
RSpec.describe "売上と返金の分離" do
  let(:user) { create(:user, :confirmed) }
  let(:now) { Time.zone.local(2026, 8, 20, 12) }

  def payment!(amount, at:, kind: "topup_purchase", live: true)
    CreditTransaction.create!(user: user, kind: kind, delta: 1000, amount_cents: amount,
                              currency: "jpy", livemode: live, created_at: at)
  end

  def refund!(amount, at:, key: SecureRandom.hex(6), live: true)
    CreditTransaction.create!(user: user, kind: "refund", delta: 0, amount_cents: -amount,
                              currency: "jpy", livemode: live, created_at: at,
                              stripe_event_id: key)
  end

  def finance(year: 2026, month: 8)
    Admin::FinanceService.call(year: year, month: month)
  end

  describe "Gross" do
    it "返金があっても、売上そのものは変わらない" do
      payment!(1_000, at: now)
      before = finance[:revenue][:total]

      refund!(1_000, at: now)

      expect(finance[:revenue][:total]).to eq(before)
    end

    it "決済の合計をそのまま出す" do
      payment!(190, at: now)
      payment!(1_480, at: now, kind: "subscription_grant")

      expect(finance[:revenue][:total]).to eq(1_670)
    end
  end

  describe "Refunds" do
    it "負の値で出す" do
      payment!(1_000, at: now)
      refund!(190, at: now)

      expect(finance[:revenue][:refunds]).to eq(-190)
    end

    it "返金が無ければ 0" do
      payment!(1_000, at: now)

      expect(finance[:revenue][:refunds]).to eq(0)
    end

    # 部分返金は Refund 1件 = 1行。合計すれば正しい額になる
    it "同じ決済への複数回の部分返金を、合計して数える" do
      payment!(1_000, at: now)
      refund!(300, at: now)
      refund!(200, at: now)
      refund!(500, at: now)

      expect(finance[:revenue][:refunds]).to eq(-1_000)
    end

    it "テストの返金は本番の集計に混ぜない" do
      payment!(1_000, at: now)
      refund!(500, at: now, live: false)

      expect(finance[:revenue][:refunds]).to eq(0)
    end
  end

  describe "Net" do
    it "売上から返金を引いた額" do
      payment!(1_670, at: now)
      refund!(190, at: now)

      expect(finance[:revenue][:net]).to eq(1_480)
    end

    it "全額返金なら 0" do
      payment!(1_670, at: now)
      refund!(1_670, at: now)

      expect(finance[:revenue][:net]).to eq(0)
    end
  end

  # 過去の月の数字が後から動くと、一度読んだ数字が信じられなくなる
  describe "月をまたぐ返金" do
    let(:paid_at) { Time.zone.local(2026, 7, 10, 12) }
    let(:refunded_at) { Time.zone.local(2026, 8, 10, 12) }

    before do
      payment!(1_000, at: paid_at)
      refund!(1_000, at: refunded_at)
    end

    it "決済の月には、売上がそのまま残る（遡って引き直さない）" do
      july = finance(month: 7)

      expect(july[:revenue][:total]).to eq(1_000)
      expect(july[:revenue][:refunds]).to eq(0)
      expect(july[:revenue][:net]).to eq(1_000)
    end

    it "返金の月に、返金として立つ" do
      august = finance(month: 8)

      expect(august[:revenue][:total]).to eq(0)
      expect(august[:revenue][:refunds]).to eq(-1_000)
      expect(august[:revenue][:net]).to eq(-1_000)
    end
  end

  describe "手数料と粗利" do
    before { payment!(10_000, at: now) }

    # 返金しても、元の決済の処理手数料は戻らない
    it "手数料は Gross に掛ける（返金しても減らない）" do
      before_fee = finance[:cost][:stripe_fee]

      refund!(10_000, at: now)

      expect(finance[:cost][:stripe_fee]).to eq(before_fee)
    end

    it "粗利は Net から引く（返金したぶんは手元に無い）" do
      refund!(10_000, at: now)
      result = finance

      expect(result[:revenue][:net]).to eq(0)
      # Net が 0 なので、粗利は費用ぶんだけ負になる
      expect(result[:profit]).to eq(0 - result[:cost][:total])
    end

    it "Net が 0 以下なら、粗利率は出さない" do
      refund!(10_000, at: now)

      expect(finance[:margin]).to be_nil
    end
  end
end
