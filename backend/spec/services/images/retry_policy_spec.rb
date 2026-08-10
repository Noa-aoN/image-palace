require "rails_helper"

RSpec.describe Images::RetryPolicy do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user) }

  def fail_with!(kind, free_retries: 0)
    item.mark_generation_failed!(message: "失敗しました", code: "Faraday::BadRequestError", kind: kind)
    item.update!(metadata: item.metadata.merge("free_retries" => free_retries)) if free_retries.positive?
    item.reload
  end

  describe ".decide" do
    it "方針に触れた失敗は、入力が同じなら通さない" do
      fail_with!("content_policy")

      decision = described_class.decide(target: item, changed_input: false)

      expect(decision).not_to be_allowed
      expect(decision.reason).to include("単語か指示を変えて")
    end

    it "入力から絵を決められない失敗も、入力が同じなら通さない" do
      fail_with!("invalid_input")

      expect(described_class.decide(target: item, changed_input: false)).not_to be_allowed
    end

    it "入力が変われば、別の注文なので通す" do
      fail_with!("content_policy", free_retries: described_class::FREE_RETRY_LIMIT)

      decision = described_class.decide(target: item, changed_input: true)

      expect(decision).to be_allowed
      expect(decision).not_to be_charge
    end

    it "供給側の枯渇が続いている間は通さない" do
      ProviderIncident.record!(provider: "openai", kind: ProviderIncident::QUOTA_EXHAUSTED)
      fail_with!("quota")

      expect(described_class.decide(target: item, changed_input: false)).not_to be_allowed
    end

    it "枯渇が収まっていれば通す" do
      incident = ProviderIncident.record!(provider: "openai", kind: ProviderIncident::QUOTA_EXHAUSTED)
      incident.update!(last_occurred_at: (ProviderIncident::ONGOING_WINDOW + 1.hour).ago)
      fail_with!("quota")

      expect(described_class.decide(target: item, changed_input: false)).to be_allowed
    end

    it "一時的な失敗は、無料の回数までは無料で通す" do
      fail_with!("temporary", free_retries: described_class::FREE_RETRY_LIMIT - 1)

      decision = described_class.decide(target: item, changed_input: false)

      expect(decision).to be_allowed
      expect(decision).not_to be_charge
    end

    it "無料の回数を使い切ったら、通すがクレジットを取る" do
      fail_with!("temporary", free_retries: described_class::FREE_RETRY_LIMIT)

      decision = described_class.decide(target: item, changed_input: false)

      expect(decision).to be_allowed
      expect(decision).to be_charge
    end
  end

  describe ".count_free_retry!" do
    it "数え、reset で 0 に戻す" do
      fail_with!("temporary")

      described_class.count_free_retry!(item)
      expect(described_class.free_retries(item.reload)).to eq(1)

      described_class.count_free_retry!(item, reset: true)
      expect(described_class.free_retries(item.reload)).to eq(0)
    end
  end

  it "出来上がったら無料の回数は 0 に戻る" do
    fail_with!("temporary", free_retries: 3)

    item.update_generation_status!("completed")

    expect(described_class.free_retries(item.reload)).to eq(0)
  end
end
