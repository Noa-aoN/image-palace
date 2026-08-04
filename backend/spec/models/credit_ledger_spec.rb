require "rails_helper"

# User のクレジット台帳ロジック（2バケット制：サブスク分は月次リセット、Top-up は繰り越し）。
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
    it "resets the subscription bucket and logs expire + grant" do
      user.update!(subscription_credits: 7)

      expect {
        user.reset_subscription_credits!(100)
      }.to change { user.reload.subscription_credits }.from(7).to(100)

      kinds = user.credit_transactions.order(:created_at).pluck(:kind)
      expect(kinds).to eq(%w[subscription_expire subscription_grant])
      expect(user.topup_credits).to eq(0)
    end

    it "skips the expire log when there is nothing to forfeit" do
      expect {
        user.reset_subscription_credits!(50)
      }.to change(CreditTransaction, :count).by(1)
      expect(user.credit_transactions.last.kind).to eq("subscription_grant")
    end

    it "forfeits without logging a grant when amount is zero (解約時の失効)" do
      user.update!(subscription_credits: 40)

      expect {
        user.reset_subscription_credits!(0)
      }.to change { user.reload.subscription_credits }.from(40).to(0)

      kinds = user.credit_transactions.order(:created_at).pluck(:kind)
      expect(kinds).to eq(%w[subscription_expire]) # 0デルタの subscription_grant は残さない
    end
  end

  describe "#add_topup_credits!" do
    it "adds to the topup bucket and logs a purchase" do
      user.add_topup_credits!(100)
      expect(user.reload.topup_credits).to eq(100)
      expect(user.credit_transactions.last.kind).to eq("topup_purchase")
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
      expect(trial.expires_at).to be_within(1.day).of(Billing::Catalog::CREDIT_LIFETIME.from_now)
      expect(user.credit_grants.find_by(kind: "monthly_free")).to be_present
      expect(user.trial_granted_at).to be_present
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
end
