require "rails_helper"

# 返金を受け取ったときの振る舞い。
#
# **正本は `refund.created`。** 「返金1件 = Refund 1件」で数える。
# `charge.refunded` は使わない（同じ Charge に複数回の部分返金があると、
# 毎回**累計額**を持って発火するので、その回いくら返したのかが読めない）。
#
# **クレジットは自動で戻さない。** 使い切ったぶんの扱いも、部分返金の按分も、
# 事業としての判断が要る。誤って戻すほうが、手で直すより危ない。
# いま塞ぎたいのは「**返金に気づかない**」という一点だけ。
RSpec.describe "返金の受け取り" do
  let(:user) { create(:user, :confirmed) }

  def handle(event_hash)
    event = Stripe::Event.construct_from(event_hash)
    allow(Stripe::Webhook).to receive(:construct_event).and_return(event)
    Billing::WebhookHandler.call(payload: "{}", signature: "sig", secret: "whsec_x")
  end

  # Refund は顧客を持たない。元の決済まで辿って突き止める
  def stub_charge(customer: "cus_known")
    allow(Stripe::Charge).to receive(:retrieve).and_return(
      Stripe::Charge.construct_from(id: "ch_1", customer: customer)
    )
  end

  def refund_event(event_id: "evt_r1", refund_id: "re_1", amount: 190, status: "succeeded",
                   reason: "requested_by_customer", livemode: true)
    {
      id: event_id, type: "refund.created",
      data: { object: {
        id: refund_id, object: "refund", amount: amount, currency: "jpy",
        status: status, reason: reason, charge: "ch_1", payment_intent: "pi_1",
        livemode: livemode
      } }
    }
  end

  before do
    user.update!(stripe_customer_id: "cus_known")
    user.add_topup_credits!(10 * Billing::POINTS_PER_CREDIT, stripe_event_id: "cs_1",
                            amount_cents: 190, currency: "jpy")
    stub_charge
  end

  describe "受け取り" do
    it "台帳に返金として残す" do
      handle(refund_event)

      row = user.credit_transactions.find_by(kind: "refund")
      expect(row).to be_present
      expect(row.delta).to eq(0)
      expect(row.currency).to eq("jpy")
    end

    it "**鍵は返金そのものの id**（イベントの id ではない）" do
      handle(refund_event(event_id: "evt_x", refund_id: "re_abc"))

      expect(user.credit_transactions.find_by(kind: "refund").stripe_event_id).to eq("re_abc")
    end

    it "全額返金の額を記録する" do
      handle(refund_event(amount: 190))

      expect(user.credit_transactions.find_by(kind: "refund").description).to include("190", "JPY")
    end

    it "部分返金は、その回の額を記録する（累計ではない）" do
      handle(refund_event(refund_id: "re_partial", amount: 100))

      expect(user.credit_transactions.find_by(kind: "refund").description).to include("100")
    end

    it "理由と決済の id を辿れる形で残す" do
      note = (handle(refund_event) && user.credit_transactions.find_by(kind: "refund").description)

      expect(note).to include("requested_by_customer", "ch_1", "pi_1")
    end

    # 返金は後から失敗しうる。**どの状態で受けたか**が残っていないと、後から辿れない
    it "受け取った時点の status を残す" do
      handle(refund_event(status: "pending"))

      expect(user.credit_transactions.find_by(kind: "refund").description).to include("status=pending")
    end

    it "理由が無くても落ちない" do
      expect { handle(refund_event(reason: nil)) }.to change(CreditTransaction, :count).by(1)
    end

    it "status が無くても落ちない" do
      handle(refund_event(status: nil))

      expect(user.credit_transactions.find_by(kind: "refund").description).to include("status=不明")
    end

    it "テストの返金は、そのモードのまま記録する（本番と混ぜない）" do
      handle(refund_event(livemode: false))

      expect(user.credit_transactions.find_by(kind: "refund").livemode).to be(false)
    end
  end

  # ここが要。**勝手に減らさない**
  describe "クレジットと契約は動かさない" do
    it "残高が変わらない" do
      before_points = user.reload.available_credit_points

      handle(refund_event)

      expect(user.reload.available_credit_points).to eq(before_points)
    end

    it "付与の束にも触らない" do
      handle(refund_event)

      expect(user.credit_grants.find_by(kind: "topup").remaining_points)
        .to eq(10 * Billing::POINTS_PER_CREDIT)
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

    # 集計側が機械的に読めるように、金額は負で持つ。
    # 売上（Gross）は「返金の行を外して」数えるので、意味は変わらない
    it "金額を負で持つ（集計が読めるように）" do
      handle(refund_event(amount: 190))

      expect(user.credit_transactions.find_by(kind: "refund").amount_cents).to eq(-190)
    end
  end

  describe "二重処理" do
    it "同じ返金が再送されても、行は増えない" do
      handle(refund_event)

      expect { handle(refund_event) }.not_to change { user.credit_transactions.where(kind: "refund").count }
    end

    # イベントの id が違っても、同じ返金なら1行に収まる
    it "別のイベントで同じ返金が届いても、行は増えない" do
      handle(refund_event(event_id: "evt_1", refund_id: "re_same"))

      expect { handle(refund_event(event_id: "evt_2", refund_id: "re_same")) }
        .not_to change { user.credit_transactions.where(kind: "refund").count }
    end

    it "別の返金（部分返金の2回目など）は別の行として残る" do
      handle(refund_event(refund_id: "re_1", amount: 100))

      expect { handle(refund_event(event_id: "evt_2", refund_id: "re_2", amount: 90)) }
        .to change { user.credit_transactions.where(kind: "refund").count }.by(1)
    end
  end

  describe "宛先が分からない返金" do
    it "元の決済が辿れなければ、落ちずに済ませる" do
      allow(Stripe::Charge).to receive(:retrieve).and_raise(Stripe::InvalidRequestError.new("no", "charge"))

      expect { handle(refund_event) }.not_to raise_error
    end

    it "知らない顧客なら、台帳には残さない（誰のものか決められないため）" do
      stub_charge(customer: "cus_unknown")

      expect { handle(refund_event) }.not_to change(CreditTransaction, :count)
    end
  end

  it "署名が通らないものは処理しない" do
    allow(Stripe::Webhook).to receive(:construct_event)
      .and_raise(Stripe::SignatureVerificationError.new("bad", "sig"))

    expect { Billing::WebhookHandler.call(payload: "{}", signature: "bad", secret: "whsec_x") }
      .to raise_error(Billing::WebhookHandler::SignatureError)
  end

  it "使わない側のイベント（charge.refunded）では何もしない" do
    expect {
      handle(id: "evt_c", type: "charge.refunded",
             data: { object: { id: "ch_1", customer: "cus_known", amount_refunded: 190 } })
    }.not_to change(CreditTransaction, :count)
  end
end

# 返金が来たときに「どの束を戻すか」を選べるようにしておく。
# **今回の返金処理では使わない**（自動回収をしないため）。将来の土台
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

  # 月額は束を作らない（users.subscription_credits に載る）。
  # **辿れるのは台帳まで**という非対称がある
  it "月額の付与は束を作らない" do
    plan = create(:plan, :standard)
    sub = Subscription.create!(user: user, plan: plan, status: "active",
                               stripe_subscription_id: "sub_2", stripe_customer_id: "cus_x",
                               current_period_end: 20.days.from_now, started_at: Time.current)

    expect { user.reset_subscription_credits!(100 * Billing::POINTS_PER_CREDIT, subscription: sub) }
      .not_to change(CreditGrant, :count)
  end
end
