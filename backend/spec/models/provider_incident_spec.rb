require "rails_helper"

RSpec.describe ProviderIncident do
  let(:now) { Time.current }

  describe ".record!" do
    it "初回は新しい行を作る" do
      incident = described_class.record!(provider: "openai", kind: described_class::QUOTA_EXHAUSTED, code: "credit_balance_exhausted", now: now)

      expect(incident.occurrences).to eq(1)
      expect(incident.first_occurred_at).to be_within(1.second).of(now)
      expect(described_class.count).to eq(1)
    end

    # 一括作成で枯渇すると件数ぶん呼ばれる。行を増やさず回数だけ数える
    it "窓の中の同一事象はまとめて回数を増やす" do
      3.times { described_class.record!(provider: "openai", kind: described_class::QUOTA_EXHAUSTED, now: now) }

      expect(described_class.count).to eq(1)
      expect(described_class.first.occurrences).to eq(3)
    end

    it "窓を過ぎたら別の事象として記録する" do
      described_class.record!(provider: "openai", kind: described_class::QUOTA_EXHAUSTED, now: now - 2.hours)
      described_class.record!(provider: "openai", kind: described_class::QUOTA_EXHAUSTED, now: now)

      expect(described_class.count).to eq(2)
    end

    it "provider が違えば別の行になる" do
      described_class.record!(provider: "openai", kind: described_class::QUOTA_EXHAUSTED, now: now)
      described_class.record!(provider: "fal", kind: described_class::QUOTA_EXHAUSTED, now: now)

      expect(described_class.count).to eq(2)
    end
  end

  describe "#ongoing?" do
    it "直近の発生なら継続中とみなす" do
      incident = described_class.record!(provider: "openai", kind: described_class::QUOTA_EXHAUSTED, now: now)

      expect(incident.ongoing?(now: now)).to be(true)
    end

    it "十分に古ければ継続中とみなさない" do
      incident = described_class.record!(provider: "openai", kind: described_class::QUOTA_EXHAUSTED, now: now - 7.hours)

      expect(incident.ongoing?(now: now)).to be(false)
    end
  end
end
