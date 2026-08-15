require "rails_helper"

# 返金を受け取ったときの振る舞い。
#
# **クレジットは自動で戻さない。** 使い切ったぶんの扱いも、部分返金の按分も、
# 事業としての判断が要る。誤って戻すほうが、手で直すより危ない。
#
# いま塞ぎたいのは「**返金に気づかない**」という一点だけ。
RSpec.describe "返金の受け取り" do
  let(:user) { create(:user, :confirmed) }

  def handle(event_hash)
    event = Stripe::Event.construct_from(event_hash)
    allow(Stripe::Webhook).to receive(:construct_event).and_return(event)
    Billing::WebhookHandler.call(payload: "{}", signature: "sig", secret: "whsec_x")
  end

  def refund_event(id: "evt_r1", amount: 190, refunded: true, customer: "cus_known", livemode: true)
    {
      id: id, type: "charge.refunded",
      data: { object: {
        id: "ch_1", customer: customer, amount_refunded: amount, refunded: refunded,
        currency: "jpy", livemode: livemode, payment_intent: "pi_1", invoice: nil
      } }
    }
  end

  before do
    user.update!(stripe_customer_id: "cus_known")
    user.add_topup_credits!(10 * Billing::POINTS_PER_CREDIT, stripe_event_id: "cs_1",
                            amount_cents: 190, currency: "jpy")
  end

  it "台帳に返金として残す" do
    handle(refund_event)

    row = user.credit_transactions.find_by(kind: "refund")
    expect(row).to be_present
    expect(row.delta).to eq(0)
    expect(row.currency).to eq("jpy")
    expect(row.livemode).to be(true)
  end

  it "金額・全額か一部か・決済の id を辿れる形で残す" do
    handle(refund_event(amount: 100, refunded: false))

    note = user.credit_transactions.find_by(kind: "refund").description
    expect(note).to include("100", "JPY", "一部", "ch_1", "pi_1")
  end

  # ここが要。**勝手に減らさない**
  it "クレジットの残高を変えない" do
    before_points = user.reload.available_credit_points

    handle(refund_event)

    expect(user.reload.available_credit_points).to eq(before_points)
  end

  it "付与の束にも触らない" do
    handle(refund_event)

    grant = user.credit_grants.find_by(kind: "topup")
    expect(grant.remaining_points).to eq(10 * Billing::POINTS_PER_CREDIT)
  end

  it "契約の状態を変えない" do
    plan = create(:plan, :standard)
    sub = Subscription.create!(user: user, plan: plan, status: "active",
                               stripe_subscription_id: "sub_1", stripe_customer_id: "cus_known",
                               current_period_end: 20.days.from_now, started_at: Time.current)

    handle(refund_event)

    expect(sub.reload.status).to eq("active")
    expect(sub.cancel_at_period_end).to be(false)
  end

  # 売上の集計は amount_cents をそのまま足す。入れると「入ってきたお金」の意味が黙って変わる
  it "金額を売上の列には入れない（既存の集計を動かさない）" do
    handle(refund_event)

    expect(user.credit_transactions.find_by(kind: "refund").amount_cents).to be_nil
  end

  describe "二重処理" do
    it "同じ返金が再送されても、行は増えない" do
      handle(refund_event)

      expect { handle(refund_event) }.not_to change { user.credit_transactions.where(kind: "refund").count }
    end

    it "別の返金（部分返金の2回目など）は別の行として残る" do
      handle(refund_event(id: "evt_r1", amount: 100, refunded: false))

      expect { handle(refund_event(id: "evt_r2", amount: 190, refunded: true)) }
        .to change { user.credit_transactions.where(kind: "refund").count }.by(1)
    end
  end

  describe "宛先が分からない返金" do
    it "落ちずに済ませる（webhook は 2xx を返す）" do
      expect { handle(refund_event(customer: "cus_unknown")) }.not_to raise_error
    end

    it "台帳には残さない（誰のものか決められないため）" do
      expect { handle(refund_event(customer: "cus_unknown")) }
        .not_to change(CreditTransaction, :count)
    end
  end

  it "署名が通らないものは処理しない" do
    allow(Stripe::Webhook).to receive(:construct_event)
      .and_raise(Stripe::SignatureVerificationError.new("bad", "sig"))

    expect { Billing::WebhookHandler.call(payload: "{}", signature: "bad", secret: "whsec_x") }
      .to raise_error(Billing::WebhookHandler::SignatureError)
  end

  it "テストの返金は、そのモードのまま記録する（本番と混ぜない）" do
    handle(refund_event(id: "evt_test", livemode: false))

    expect(user.credit_transactions.find_by(kind: "refund").livemode).to be(false)
  end
end

# 返金が来たときに「どの束を戻すか」を選べるようにしておく
RSpec.describe "付与と決済の紐付け" do
  let(:user) { create(:user, :confirmed) }

  it "買い切りの束は、どの決済で積んだかを覚えている" do
    user.add_topup_credits!(10 * Billing::POINTS_PER_CREDIT, stripe_event_id: "cs_abc",
                            amount_cents: 190, currency: "jpy")

    expect(user.credit_grants.find_by(kind: "topup").metadata["payment_key"]).to eq("cs_abc")
  end

  it "鍵が無い付与でも壊れない（手で足したぶんなど）" do
    user.add_topup_credits!(5 * Billing::POINTS_PER_CREDIT)

    expect(user.credit_grants.find_by(kind: "topup").metadata).to eq({})
  end
end
