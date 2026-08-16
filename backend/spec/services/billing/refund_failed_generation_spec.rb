require "rails_helper"

RSpec.describe Billing::RefundFailedGeneration do
  let(:user) { create(:user) }
  let(:limit) { Images::RetryPolicy::FREE_RETRY_LIMIT }

  # 先に 1cr もらってから作る、という実際の流れを再現する。
  # 記録（credit_transactions）から返す額を決めているので、ここを省くと返せない
  def charged_item(kind:, free_retries: limit, points: Billing::POINTS_PER_CREDIT)
    user.grant_credits!(points, kind: "trial")
    item = create(:item, user: user, generation_status: "failed")
    user.consume_credits!(points, item: item)
    item.update!(
      metadata: (item.metadata || {}).merge(
        "generation_failure_kind" => kind,
        "free_retries" => free_retries
      )
    )
    item
  end

  describe "失敗の種類ごとの扱い" do
    # 供給側の枯渇。利用者には直しようがないので返す
    it "quota は返す" do
      item = charged_item(kind: "quota")
      expect { described_class.call(item) }
        .to change { user.reload.available_credit_points }.by(Billing::POINTS_PER_CREDIT)
    end

    # 通信・混雑。時間を置けば直り得たはずのもの
    it "temporary は返す" do
      item = charged_item(kind: "temporary")
      expect { described_class.call(item) }
        .to change { user.reload.available_credit_points }.by(Billing::POINTS_PER_CREDIT)
    end

    # 入力を変えれば無料で試せる。返すと、通らない入力を出し続けるほど得になる
    it "content_policy は返さない" do
      item = charged_item(kind: "content_policy")
      expect { described_class.call(item) }.not_to change { user.reload.available_credit_points }
      expect(described_class.call(item)).to be(false)
    end

    it "invalid_input は返さない" do
      item = charged_item(kind: "invalid_input")
      expect { described_class.call(item) }.not_to change { user.reload.available_credit_points }
      expect(described_class.call(item)).to be(false)
    end
  end

  describe "返す条件" do
    # 途中で一度でも絵が出ていれば、注文は果たされている
    it "一度でも成果物があれば返さない" do
      item = charged_item(kind: "temporary")
      allow(item).to receive_message_chain(:medias, :exists?).and_return(true)

      expect { described_class.call(item) }.not_to change { user.reload.available_credit_points }
    end

    # 無料の作り直しが残っているうちは、その注文はまだ終わっていない
    it "無料の作り直しが残っていれば返さない" do
      item = charged_item(kind: "temporary", free_retries: limit - 1)

      expect { described_class.call(item) }.not_to change { user.reload.available_credit_points }
    end

    it "無料の作り直しを使い切っていれば返す" do
      item = charged_item(kind: "temporary", free_retries: limit)

      expect(described_class.call(item)).to be(true)
    end
  end

  describe "二重返却の防止" do
    # ジョブは再送・手動実行で何度でも走り得る。ここが唯一の歯止め
    it "2回呼んでも1回ぶんしか返さない" do
      item = charged_item(kind: "quota")

      expect { described_class.call(item) }
        .to change { user.reload.available_credit_points }.by(Billing::POINTS_PER_CREDIT)
      expect { described_class.call(item.reload) }.not_to change { user.reload.available_credit_points }
    end

    it "返したことをカードに残す" do
      item = charged_item(kind: "quota")
      described_class.call(item)

      metadata = item.reload.metadata
      expect(metadata[described_class::REFUNDED_AT_KEY]).to be_present
      expect(metadata[described_class::REFUNDED_POINTS_KEY]).to eq(Billing::POINTS_PER_CREDIT)
    end

    # Stripe の返金とは別物。売上の集計に混ぜない
    it "Stripe の返金とは別の種類で付与する" do
      item = charged_item(kind: "quota")
      described_class.call(item)

      grant = user.credit_grants.order(:created_at).last
      expect(grant.kind).to eq("compensation")
      expect(grant.metadata["item_id"]).to eq(item.id)
    end
  end

  describe "返す額" do
    # 単価表が後から変わっても、払った額と食い違わせない
    it "実際に引いた額を返す（単価が違っても合う）" do
      item = charged_item(kind: "quota", points: 250)

      expect { described_class.call(item) }.to change { user.reload.available_credit_points }.by(250)
    end

    it "引いた記録が無ければ返さない" do
      item = create(:item, user: user, generation_status: "failed")
      item.update!(
        metadata: { "generation_failure_kind" => "quota", "free_retries" => limit }
      )

      expect(described_class.call(item)).to be(false)
    end
  end
end
