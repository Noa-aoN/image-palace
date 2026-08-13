require "rails_helper"

# User のクレジット台帳ロジック（当月分・期限付きグラント・古い買い切りの3つの入れ物）。
RSpec.describe "User credit ledger", type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "balances" do
    it "available_credit_points sums both buckets (points)" do
      user.update!(subscription_credits: 30, topup_credits: 5)
      expect(user.available_credit_points).to eq(35)
    end

    it "available_credits shows points as credits (1cr = 100pt)" do
      user.update!(subscription_credits: 150, topup_credits: 50)
      expect(user.available_credits).to eq(2.0)
    end
  end

  describe "#reset_subscription_credits!" do
    it "使い残しは失効させず、期限付きの持ち越しに移す" do
      user.update!(subscription_credits: 7)

      expect {
        user.reset_subscription_credits!(100)
      }.to change { user.reload.subscription_credits }.from(7).to(100)

      carryover = user.credit_grants.find_by(kind: "subscription_carryover")
      expect(carryover.remaining_points).to eq(7)
      # 届いた日から数えて寿命ぶん（当月分として1ヶ月すでに居たので、持ち越しは1ヶ月短い）
      expect(carryover.expires_at).to be_within(1.day).of(Billing::CreditExpiryPolicy.carryover_expires_at)

      # 入れ物を移しただけなので、残高も台帳も「増えた・減った」を書かない
      kinds = user.credit_transactions.order(:created_at).pluck(:kind)
      expect(kinds).to eq(%w[subscription_grant])
      expect(user.available_credit_points).to eq(107)
    end

    it "使い残しが無ければ持ち越しを作らない" do
      expect {
        user.reset_subscription_credits!(50)
      }.to change(CreditTransaction, :count).by(1)
      expect(user.credit_transactions.last.kind).to eq("subscription_grant")
      expect(user.credit_grants.where(kind: "subscription_carryover")).to be_empty
    end

    it "forfeit: true では失効させる（解約時。0デルタの付与ログは残さない）" do
      user.update!(subscription_credits: 40)

      expect {
        user.reset_subscription_credits!(0, forfeit: true)
      }.to change { user.reload.subscription_credits }.from(40).to(0)

      kinds = user.credit_transactions.order(:created_at).pluck(:kind)
      expect(kinds).to eq(%w[subscription_expire])
      expect(user.credit_grants.where(kind: "subscription_carryover")).to be_empty
    end
  end

  describe "#add_topup_credits!" do
    it "期限付きで積み、購入として記録する" do
      user.add_topup_credits!(100)

      grant = user.reload.credit_grants.find_by(kind: "topup")
      expect(grant.remaining_points).to eq(100)
      expect(grant.expires_at).to be_within(1.day).of(Billing::CreditExpiryPolicy.expires_at)
      expect(user.available_credit_points).to eq(100)
      expect(user.credit_transactions.last.kind).to eq("topup_purchase")
    end

    it "買うたびに別の期限で積まれる（まとめて期限が延びない）" do
      user.add_topup_credits!(100)
      travel_to(1.month.from_now) { user.add_topup_credits!(100) }

      expiries = user.reload.credit_grants.where(kind: "topup").pluck(:expires_at)
      expect(expiries.uniq.size).to eq(2)
    end
  end

  describe "#consume_credits!" do
    it "draws from the subscription bucket first, then topup" do
      user.update!(subscription_credits: 3, topup_credits: 10)

      user.consume_credits!(5)

      user.reload
      expect(user.subscription_credits).to eq(0)
      expect(user.topup_credits).to eq(8)
      expect(user.available_credit_points).to eq(8)
      expect(user.credit_transactions.last.kind).to eq("consumption")
      expect(user.credit_transactions.last.delta).to eq(-5)
    end

    it "raises InsufficientCredits and records nothing when balance is too low" do
      user.update!(subscription_credits: 1, topup_credits: 0)

      expect {
        expect { user.consume_credits!(2) }.to raise_error(User::InsufficientCredits)
      }.not_to change(CreditTransaction, :count)
      expect(user.reload.available_credit_points).to eq(1)
    end
  end

  describe "期限付きグラント（credit_grants）" do
    it "available_credit_points に有効グラントを含む" do
      user.update!(subscription_credits: 100, topup_credits: 0)
      user.grant_credits!(50, kind: "free_carryover", expires_at: 30.days.from_now)
      expect(user.available_credit_points).to eq(150)
      expect(user.credit_transactions.last.kind).to eq("grant")
    end

    it "期限切れ・残量0のグラントは集計に含めない" do
      user.grant_credits!(40, kind: "campaign", expires_at: 1.day.ago) # 期限切れ
      user.grant_credits!(0, kind: "campaign")                         # 0は付与されない
      expect(user.grant_credit_points).to eq(0)
    end

    it "消費は グラント(期限の近い順)→サブスク→Top-up の順" do
      user.update!(subscription_credits: 100, topup_credits: 100)
      user.grant_credits!(30, kind: "campaign", expires_at: 10.days.from_now)
      user.grant_credits!(20, kind: "free_carryover", expires_at: 2.days.from_now)

      user.consume_credits!(60) # 20(近) + 30(次) = グラント50、残り10をサブスクから

      user.reload
      expect(user.grant_credit_points).to eq(0)
      expect(user.subscription_credits).to eq(90)
      expect(user.topup_credits).to eq(100)
    end

    it "期限切れグラントは消費対象にならない（スキップしてサブスクから引く）" do
      user.update!(subscription_credits: 100, topup_credits: 0)
      user.grant_credits!(50, kind: "campaign", expires_at: 1.day.ago) # 期限切れ＝消費されない

      user.consume_credits!(30)

      user.reload
      expect(user.subscription_credits).to eq(70) # グラントは使われずサブスクから
      expect(user.credit_grants.where(kind: "campaign").first.remaining_points).to eq(50)
    end

    it "複数グラントを跨いで一部だけ消費する（近い期限から部分消費）" do
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.grant_credits!(20, kind: "free_carryover", expires_at: 2.days.from_now)
      user.grant_credits!(30, kind: "campaign", expires_at: 9.days.from_now)
      g_near = user.credit_grants.find_by(kind: "free_carryover")
      g_far = user.credit_grants.find_by(kind: "campaign")

      user.consume_credits!(35) # near 20 全消費 + far から 15

      expect(g_near.reload.remaining_points).to eq(0)
      expect(g_far.reload.remaining_points).to eq(15)
    end

    it "Top-up は最後に消費される（グラント・サブスクを使い切ってから）" do
      user.update!(subscription_credits: 10, topup_credits: 100)
      user.grant_credits!(5, kind: "goodwill", expires_at: nil)

      user.consume_credits!(20) # grant5 + sub10 + topup5

      user.reload
      expect(user.grant_credit_points).to eq(0)
      expect(user.subscription_credits).to eq(0)
      expect(user.topup_credits).to eq(95)
    end

    it "残高不足（グラント含む合算でも足りない）はマイナスにならず例外・記録なし" do
      user.update!(subscription_credits: 5, topup_credits: 0)
      user.grant_credits!(3, kind: "campaign", expires_at: 1.day.from_now)

      expect {
        expect { user.consume_credits!(20) }.to raise_error(User::InsufficientCredits)
      }.not_to change(CreditTransaction, :count)
      expect(user.reload.available_credit_points).to eq(8) # 5 + 3、減っていない
    end
  end

  describe "#ensure_free_credits!（お試しは1回・毎月は少量）" do
    let(:trial_points) { Billing::Catalog::TRIAL_CREDITS * Billing::POINTS_PER_CREDIT }
    let(:monthly_points) { Billing::Catalog::MONTHLY_FREE_CREDITS * Billing::POINTS_PER_CREDIT }

    it "はじめては、お試しと当月分をどちらも期限付きで配る" do
      expect { user.ensure_free_credits! }
        .to change { user.reload.available_credit_points }
        .from(0).to(trial_points + monthly_points)

      trial = user.credit_grants.find_by(kind: "trial")
      expect(trial.expires_at).to be_within(1.day).of(Billing::CreditExpiryPolicy.expires_at)
      expect(user.credit_grants.find_by(kind: "monthly_free")).to be_present
      expect(user.trial_granted_at).to be_present
    end

    # 残高エンドポイントは画面が繰り返し叩く。並べて投げるだけで何度も受け取れると、
    # 新規登録のたびに無料枠を好きなだけ積めてしまう（実際に 20 並列で 20 ヶ月分が出た）。
    it "同時に来たリクエストが揃って「まだ配っていない」を読んでも、配るのは1回だけ" do
      # 同じ行を指す別インスタンス＝まだ誰も書いていない状態を読んだ同時リクエスト
      concurrent = Array.new(20) { User.find(user.id) }

      concurrent.each(&:ensure_free_credits!)

      expect(user.reload.available_credit_points).to eq(trial_points + monthly_points)
      expect(user.credit_grants.where(kind: "monthly_free").count).to eq(1)
      expect(user.credit_grants.where(kind: "trial").count).to eq(1)
    end

    it "同じ月に何度呼んでも増えない" do
      user.ensure_free_credits!

      expect { user.ensure_free_credits! }.not_to(change { user.reload.available_credit_points })
      expect(user.credit_grants.where(kind: "trial").count).to eq(1)
    end

    it "月が変わると当月分だけ配る（お試しは配り直さない）" do
      user.ensure_free_credits!

      travel_to(2.months.from_now) do
        expect { user.ensure_free_credits! }
          .to change { user.reload.available_credit_points }.by(monthly_points)
      end
      expect(user.credit_grants.where(kind: "trial").count).to eq(1)
    end

    it "来なかった月のぶんは配らない（休眠アカウントに出ていかない）" do
      travel_to(3.months.from_now) do
        user.ensure_free_credits!
      end

      # 3ヶ月ぶんではなく、訪れた時点の1回ぶんだけ
      expect(user.reload.credit_grants.where(kind: "monthly_free").count).to eq(1)
    end

    it "退会して同じアドレスで登録し直しても、お試しは配られない" do
      user.ensure_free_credits!
      email = user.email
      user.destroy!

      returning = create(:user, :confirmed, email: email)
      returning.ensure_free_credits!

      expect(returning.credit_grants.where(kind: "trial")).to be_empty
      expect(returning.available_credit_points).to eq(monthly_points)
    end

    it "同じ Google アカウントで登録し直してもお試しは配られない" do
      oauth_user = create(:user, :confirmed, provider: "google_oauth2", uid: "g-1")
      oauth_user.ensure_free_credits!
      oauth_user.destroy!

      returning = create(:user, :confirmed, provider: "google_oauth2", uid: "g-1")
      returning.ensure_free_credits!

      expect(returning.credit_grants.where(kind: "trial")).to be_empty
    end

    it "使い切ってもお試しは配り直されない" do
      user.ensure_free_credits!
      user.consume_credits!(user.available_credit_points)

      expect { user.ensure_free_credits! }.not_to(change { user.reload.available_credit_points })
    end

    it "有料契約があるなら配らない（プランのぶんが届くため）" do
      create(:subscription, user:, status: "active")
      expect { user.ensure_free_credits! }.not_to(change { user.reload.available_credit_points })
    end

    it "trial 中の契約でも配らない" do
      create(:subscription, user:, status: "trialing")
      expect { user.ensure_free_credits! }.not_to(change { user.reload.available_credit_points })
    end

    it "配りすぎのブレーカーが働いたら配らないが、何度も試させない" do
      allow(Billing::FreeGrantGuard).to receive(:allow?).and_return(false)

      expect { user.ensure_free_credits! }.not_to(change { user.reload.available_credit_points })
      expect(user.trial_granted_at).to be_present
    end

    it "旧名でも同じように動く（呼び出し側を一度に直さないため）" do
      expect { user.ensure_current_period_credits! }
        .to change { user.reload.available_credit_points }.from(0)
    end

    it "登録1件あたりの持ち出しに上限がある（回収の当てがない支出のため）" do
      cost = (Billing::Catalog::TRIAL_CREDITS * Billing::Catalog::COST_PER_CREDIT)
      expect(cost).to be <= 30
    end
  end

  describe "消費の順番（期限が近いものから）" do
    let(:one) { Billing::POINTS_PER_CREDIT }

    it "月末で消える月額分を、まだ数ヶ月ある期限付きより先に使う" do
      user.update!(subscription_credits: 5 * one)
      grant = user.credit_grants.create!(
        kind: "topup", amount_points: 5 * one, remaining_points: 5 * one,
        expires_at: 6.months.from_now
      )

      user.consume_credits!(3 * one)

      expect(user.reload.subscription_credits).to eq(2 * one)
      expect(grant.reload.remaining_points).to eq(5 * one)
    end

    it "月額分より先に切れるグラントがあれば、そちらを先に使う" do
      user.update!(subscription_credits: 5 * one)
      soon = user.credit_grants.create!(
        kind: "trial", amount_points: 3 * one, remaining_points: 3 * one, expires_at: 2.days.from_now
      )

      user.consume_credits!(2 * one)

      expect(soon.reload.remaining_points).to eq(1 * one)
      expect(user.reload.subscription_credits).to eq(5 * one)
    end

    it "期限付きが尽きたら次に近いものへ移る" do
      soon = user.credit_grants.create!(
        kind: "trial", amount_points: 2 * one, remaining_points: 2 * one, expires_at: 2.days.from_now
      )
      later = user.credit_grants.create!(
        kind: "topup", amount_points: 5 * one, remaining_points: 5 * one, expires_at: 3.months.from_now
      )

      user.consume_credits!(4 * one)

      expect(soon.reload.remaining_points).to eq(0)
      expect(later.reload.remaining_points).to eq(3 * one)
    end

    it "期限の無いぶんは最後に使う（待てるため）" do
      user.update!(topup_credits: 5 * one)
      grant = user.credit_grants.create!(
        kind: "topup", amount_points: 5 * one, remaining_points: 5 * one, expires_at: 1.month.from_now
      )

      user.consume_credits!(3 * one)

      expect(grant.reload.remaining_points).to eq(2 * one)
      expect(user.reload.topup_credits).to eq(5 * one)
    end

    it "期限切れのグラントからは使わない" do
      expired = user.credit_grants.create!(
        kind: "trial", amount_points: 5 * one, remaining_points: 5 * one, expires_at: 1.day.ago
      )
      user.update!(subscription_credits: 5 * one)

      user.consume_credits!(3 * one)

      expect(expired.reload.remaining_points).to eq(5 * one)
      expect(user.reload.subscription_credits).to eq(2 * one)
    end

    it "複数にまたがっても、合計はちょうど引かれる" do
      user.update!(subscription_credits: 2 * one, topup_credits: 2 * one)
      user.credit_grants.create!(
        kind: "trial", amount_points: 2 * one, remaining_points: 2 * one, expires_at: 1.day.from_now
      )
      before = user.available_credit_points

      user.consume_credits!(5 * one)

      expect(user.reload.available_credit_points).to eq(before - 5 * one)
    end

    it "足りなければ何も減らさない" do
      user.update!(subscription_credits: 2 * one)
      user.credit_grants.create!(
        kind: "trial", amount_points: 1 * one, remaining_points: 1 * one, expires_at: 1.day.from_now
      )

      expect { user.consume_credits!(10 * one) }.to raise_error(User::InsufficientCredits)
      expect(user.reload.available_credit_points).to eq(3 * one)
    end
  end
end
