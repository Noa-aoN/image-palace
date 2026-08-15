require "rails_helper"

# Test と Live の取り違え。
#
# **今回の Live 切替で実際に起きた事故の形**をそのまま固定する。
# どれも「決済画面に進めない」「webhook が全部弾かれる」という、
# 利用者からは原因の分からない止まり方をする。
RSpec.describe "Test と Live の取り違え" do
  let(:user) { create(:user, :confirmed) }

  # 事故1: Sandbox で作った顧客 id が Live に残っていた
  describe "別モードで作られた顧客" do
    it "いまの鍵から引けない顧客は、作り直してから決済に進む" do
      user.update!(stripe_customer_id: "cus_from_other_mode")
      allow(Stripe::Customer).to receive(:retrieve)
        .and_raise(Stripe::InvalidRequestError.new("No such customer", "customer"))
      allow(Stripe::Customer).to receive(:create).and_return(double(id: "cus_current_mode"))

      expect(Billing::Customers.ensure(user)).to eq("cus_current_mode")
    end

    it "引ける顧客はそのまま使う（毎回作らない）" do
      user.update!(stripe_customer_id: "cus_ok")
      allow(Stripe::Customer).to receive(:retrieve).and_return(double(id: "cus_ok"))
      allow(Stripe::Customer).to receive(:create)

      Billing::Customers.ensure(user)

      expect(Stripe::Customer).not_to have_received(:create)
    end
  end

  # 事故2: 鍵と署名シークレットのモードが食い違うと、
  # 決済は通るのに webhook だけが全部弾かれる
  describe "鍵と署名シークレット" do
    it "同じモードの組で選ばれる" do
      env = {
        "STRIPE_MODE" => "test",
        "STRIPE_TEST_SECRET_KEY" => "sk_test_a", "STRIPE_TEST_WEBHOOK_SECRET" => "whsec_test",
        "STRIPE_LIVE_SECRET_KEY" => "sk_live_b", "STRIPE_LIVE_WEBHOOK_SECRET" => "whsec_live"
      }

      result = Billing::KeySelection.select(env: env, local: true)

      expect(result.api_key).to eq("sk_test_a")
      expect(result.webhook_secret).to eq("whsec_test")
    end
  end

  # 事故3: 手元に Live の鍵が残り、ローカル操作で実課金が起きる
  describe "手元での Live 利用" do
    it "既定では鍵を渡さない（課金そのものが起きない）" do
      result = Billing::KeySelection.select(env: { "STRIPE_SECRET_KEY" => "sk_live_x" }, local: true)

      expect(result).to be_refused
      expect(result.api_key).to be_nil
    end
  end

  # 事故4: 署名の無い・壊れた webhook を受け付けてしまう
  describe "webhook の署名" do
    it "署名が通らないものは処理しない" do
      allow(Stripe::Webhook).to receive(:construct_event)
        .and_raise(Stripe::SignatureVerificationError.new("bad", "sig"))

      expect {
        Billing::WebhookHandler.call(payload: "{}", signature: "bad", secret: "whsec_x")
      }.to raise_error(Billing::WebhookHandler::SignatureError)
    end
  end

  # 事故5: 台帳に test と live が混ざり、売上を数え間違える
  describe "台帳の目印" do
    it "決済の記録は、どちらのモードかを持つ" do
      expect(CreditTransaction.column_names).to include("livemode")
    end
  end
end
