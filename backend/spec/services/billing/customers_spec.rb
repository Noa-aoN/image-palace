require "rails_helper"

# 決済を始める前に、利用者に対応する Stripe の顧客を用意する。
#
# **持っている id をそのまま信じない。** テストモードで作った顧客は Live からは引けず、
# その id で決済を始めると "No such customer" で落ちる。
# 決済画面にすら進めないので、利用者からは原因が分からない。
RSpec.describe Billing::Customers do
  let(:user) { create(:user, :confirmed) }

  def stub_create(id)
    allow(Stripe::Customer).to receive(:create).and_return(double(id: id))
  end

  it "まだ持っていなければ作って覚える" do
    stub_create("cus_new")

    expect(described_class.ensure(user)).to eq("cus_new")
    expect(user.reload.stripe_customer_id).to eq("cus_new")
  end

  it "いまの鍵から引けるなら、持っているものを使う（毎回作らない）" do
    user.update!(stripe_customer_id: "cus_live")
    allow(Stripe::Customer).to receive(:retrieve).with("cus_live").and_return(double(id: "cus_live"))
    allow(Stripe::Customer).to receive(:create)

    expect(described_class.ensure(user)).to eq("cus_live")
    expect(Stripe::Customer).not_to have_received(:create)
  end

  # ここが本題。test → live の切り替えで残る
  it "いまの鍵から引けないものは、作り直す" do
    user.update!(stripe_customer_id: "cus_from_test_mode")
    allow(Stripe::Customer).to receive(:retrieve)
      .and_raise(Stripe::InvalidRequestError.new("No such customer", "customer"))
    stub_create("cus_live_new")

    expect(described_class.ensure(user)).to eq("cus_live_new")
    expect(user.reload.stripe_customer_id).to eq("cus_live_new")
  end

  # 一時的な不調で顧客を増やし続けない
  it "通信そのものが失敗したときは、持っているものを信じる" do
    user.update!(stripe_customer_id: "cus_live")
    allow(Stripe::Customer).to receive(:retrieve).and_raise(Stripe::APIConnectionError.new("timeout"))

    expect(described_class.ensure(user)).to eq("cus_live")
    expect(user.reload.stripe_customer_id).to eq("cus_live")
  end
end
