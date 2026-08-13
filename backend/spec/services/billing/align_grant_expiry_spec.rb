require "rails_helper"

# 既に配ってあるクレジットの期限を、いまの寿命へ揃える。
#
# 規約と画面が3ヶ月と言っているのに、残高の内訳だけ6ヶ月後を指している、
# という食い違いを残さないための後始末。
RSpec.describe Billing::AlignGrantExpiry do
  let(:user) { create(:user, :confirmed) }
  let(:lifetime) { Billing::CreditExpiryPolicy::LIFETIME }

  def grant!(kind: "campaign", created_at: 10.days.ago, expires_at: nil, remaining: 100)
    row = user.credit_grants.create!(kind: kind, amount_points: remaining, remaining_points: remaining,
                                     expires_at: expires_at || (created_at + 6.months))
    row.update_column(:created_at, created_at)
    row.reload
  end

  it "配った日から数えた期限へ揃える" do
    created_at = Time.zone.local(2026, 8, 4, 23, 33)
    row = grant!(created_at: created_at)

    described_class.call

    expect(row.reload.expires_at).to be_within(1.minute).of(created_at + lifetime)
  end

  it "何度流しても結果が変わらない（2回目は0件）" do
    grant!

    first = described_class.call
    second = described_class.call

    expect(first.updated).to eq(1)
    expect(second.updated).to eq(0)
    expect(second.already_aligned).to eq(1)
  end

  it "既にいまの寿命より短いものは触らない（縮めるだけ、伸ばさない）" do
    created_at = 10.days.ago
    row = grant!(created_at: created_at, expires_at: created_at + 1.month)

    expect { described_class.call }.not_to change { row.reload.expires_at }
  end

  it "期限を持たない古い買い切りにも期限を付ける" do
    created_at = 20.days.ago
    row = grant!(kind: "topup", created_at: created_at, expires_at: nil)
    row.update_column(:expires_at, nil)

    described_class.call

    expect(row.reload.expires_at).to be_within(1.minute).of(created_at + lifetime)
  end

  it "月額の持ち越しは1ヶ月ぶん短い期限へ揃える（積み直したときと同じになる）" do
    created_at = 5.days.ago
    row = grant!(kind: "subscription_carryover", created_at: created_at)

    described_class.call

    expect(row.reload.expires_at)
      .to be_within(1.minute).of(Billing::CreditExpiryPolicy.carryover_expires_at(created_at))
  end

  describe "揃えると期限切れになる行" do
    let!(:old_row) { grant!(created_at: 5.months.ago) }

    it "既定では触らず、数えて返す（気づかないうちに残高を消さない）" do
      result = described_class.call

      expect(result.updated).to eq(0)
      expect(result.skipped_immediate).to eq([ old_row ])
      expect(old_row.reload.expires_at).to be > Time.current
    end

    it "明示したときだけ揃える" do
      described_class.call(include_immediate: true)

      expect(old_row.reload.expires_at).to be < Time.current
    end
  end

  describe "下見" do
    it "書き込まずに件数だけ返す" do
      row = grant!

      result = described_class.call(dry_run: true)

      expect(result.updated).to eq(1)
      expect(row.reload.expires_at).to be_within(1.minute).of(row.created_at + 6.months)
    end
  end
end
