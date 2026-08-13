require "rails_helper"

# クレジットを使う順番を固定する。
#
# 原則は「失効が近いものから先に使う」。有料を先でも無料を先でもない。
# 期限で並べないと、まだ数ヶ月ある残高を先に使い、月末で消えるぶんを
# みすみす失うことになる。
#
# 同じ期限が並んだときの順も決め切る。お金の記録は、同じことをすれば
# 同じ結果になることが要る。
RSpec.describe "クレジットを使う順番" do
  let(:user) { create(:user, :confirmed) }
  let(:pt) { Billing::POINTS_PER_CREDIT }

  # 残高の内訳を「入れ物ごとの残り」で見る
  def grants_remaining
    user.credit_grants.order(:created_at, :id).pluck(:kind, :remaining_points)
  end

  # grant_credits! は台帳の行を返すので、積まれたグラント自体を拾い直す
  def grant!(points, kind: "campaign", expires_at: 1.month.from_now, created_at: nil)
    user.grant_credits!(points, kind: kind, expires_at: expires_at)
    row = user.credit_grants.order(:created_at, :id).last
    row.update_column(:created_at, created_at) if created_at
    row
  end

  describe "期限の近さで決める" do
    it "期限が近いものから使う" do
      far = grant!(10 * pt, expires_at: 60.days.from_now)
      near = grant!(10 * pt, expires_at: 5.days.from_now)

      user.consume_credits!(6 * pt)

      expect(near.reload.remaining_points).to eq(4 * pt)
      expect(far.reload.remaining_points).to eq(10 * pt)
    end

    it "無料と有料が混ざっていても、種類ではなく期限で決める" do
      # 無料枠が最も近く、次にサブスク、最後に買い切り
      free = grant!(5 * pt, kind: "monthly_free", expires_at: 10.days.from_now)
      topup = grant!(100 * pt, kind: "topup", expires_at: 80.days.from_now)
      user.update!(subscription_credits: 20 * pt)
      allow(user).to receive(:subscription_expires_at).and_return(40.days.from_now)

      user.consume_credits!(26 * pt)

      # 無料5 → サブスク20 → 買い切り1
      expect(free.reload.remaining_points).to eq(0)
      expect(user.reload.subscription_credits).to eq(0)
      expect(topup.reload.remaining_points).to eq(99 * pt)
    end

    it "期限が無いものは最後に使う（待てるため）" do
      forever = grant!(10 * pt, expires_at: nil)
      limited = grant!(10 * pt, expires_at: 3.days.from_now)

      user.consume_credits!(10 * pt)

      expect(limited.reload.remaining_points).to eq(0)
      expect(forever.reload.remaining_points).to eq(10 * pt)
    end
  end

  describe "同じ期限が並んだとき" do
    it "古く配ったものから使う" do
      same = 30.days.from_now
      older = grant!(10 * pt, expires_at: same, created_at: 3.days.ago)
      newer = grant!(10 * pt, expires_at: same, created_at: 1.day.ago)

      user.consume_credits!(10 * pt)

      expect(older.reload.remaining_points).to eq(0)
      expect(newer.reload.remaining_points).to eq(10 * pt)
    end

    it "配った時刻まで同じでも、引く先は毎回同じ" do
      same = 30.days.from_now
      at = 2.days.ago
      a = grant!(10 * pt, expires_at: same, created_at: at)
      b = grant!(10 * pt, expires_at: same, created_at: at)

      first = user.consumption_sources.map { |source| source[:points] }
      # 並べ直しても同じ順で返ること（同着を DB や sort の気分で入れ替えない）
      5.times { expect(user.consumption_sources.map { |s| s[:points] }).to eq(first) }

      expected = [ a, b ].min_by { |grant| grant.id }
      user.consume_credits!(10 * pt)
      expect(expected.reload.remaining_points).to eq(0)
    end
  end

  describe "跨いで使う" do
    it "1つで足りなければ次へ跨いで引く" do
      first = grant!(4 * pt, expires_at: 5.days.from_now)
      second = grant!(4 * pt, expires_at: 10.days.from_now)
      third = grant!(4 * pt, expires_at: 20.days.from_now)

      user.consume_credits!(9 * pt)

      expect(first.reload.remaining_points).to eq(0)
      expect(second.reload.remaining_points).to eq(0)
      expect(third.reload.remaining_points).to eq(3 * pt)
    end
  end

  describe "使わないもの" do
    it "期限切れは残っていても使わない" do
      expired = grant!(50 * pt, expires_at: 1.day.ago)
      live = grant!(10 * pt, expires_at: 10.days.from_now)

      user.consume_credits!(10 * pt)

      expect(expired.reload.remaining_points).to eq(50 * pt)
      expect(live.reload.remaining_points).to eq(0)
    end

    it "期限切れは残高にも数えない（足りないものは足りないと断る）" do
      grant!(50 * pt, expires_at: 1.day.ago)

      expect { user.consume_credits!(1 * pt) }.to raise_error(User::InsufficientCredits)
    end
  end

  describe "足りないとき" do
    it "半端に引かず、1ポイントも動かさない" do
      near = grant!(3 * pt, expires_at: 5.days.from_now)
      far = grant!(2 * pt, expires_at: 50.days.from_now)
      before = grants_remaining

      expect { user.consume_credits!(10 * pt) }.to raise_error(User::InsufficientCredits)

      expect(grants_remaining).to eq(before)
      expect(near.reload.remaining_points).to eq(3 * pt)
      expect(far.reload.remaining_points).to eq(2 * pt)
      expect(user.credit_transactions.where(kind: "consumption")).to be_empty
    end
  end

  describe "同時に引かれたとき" do
    it "行を押さえてから残高を見る（見てから引くまでの隙間を作らない）" do
      grant!(10 * pt, expires_at: 5.days.from_now)
      expect(user).to receive(:with_lock).and_call_original

      user.consume_credits!(1 * pt)
    end

    it "残高を超えて二重に引かれない" do
      grant!(10 * pt, expires_at: 5.days.from_now)

      user.consume_credits!(8 * pt)
      expect { user.consume_credits!(8 * pt) }.to raise_error(User::InsufficientCredits)

      expect(user.reload.available_credit_points).to eq(2 * pt)
      expect(user.available_credit_points).to be >= 0
    end
  end
end
