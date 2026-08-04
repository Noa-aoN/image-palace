require "rails_helper"

RSpec.describe Billing::FreeGrantGuard do
  let(:user) { create(:user, :confirmed) }
  let(:one_credit) { Billing::POINTS_PER_CREDIT }

  def grant_trial(credits, at: Time.current)
    create(:user, :confirmed).credit_grants.create!(
      kind: "trial", amount_points: credits * one_credit, remaining_points: credits * one_credit,
      created_at: at, updated_at: at
    )
  end

  describe ".allow?" do
    it "上限に余裕があれば配る" do
      expect(described_class.allow?(10 * one_credit)).to be(true)
    end

    it "1日の上限を超えるなら配らない" do
      allow(described_class).to receive(:daily_cap).and_return(20)
      grant_trial(15)

      expect(described_class.allow?(10 * one_credit)).to be(false)
    end

    it "ちょうど上限までは配る" do
      allow(described_class).to receive(:daily_cap).and_return(20)
      grant_trial(10)

      expect(described_class.allow?(10 * one_credit)).to be(true)
    end

    it "24時間より前に配ったぶんは数えない" do
      allow(described_class).to receive(:daily_cap).and_return(20)
      grant_trial(15, at: 25.hours.ago)

      expect(described_class.allow?(10 * one_credit)).to be(true)
    end

    it "お試し枠以外の付与は数えない（キャンペーン等で塞がない）" do
      allow(described_class).to receive(:daily_cap).and_return(20)
      user.grant_credits!(15 * one_credit, kind: "campaign")

      expect(described_class.allow?(10 * one_credit)).to be(true)
    end

    it "上限に当たったら記録に残す（気づけないまま出続けないように）" do
      allow(described_class).to receive(:daily_cap).and_return(1)
      grant_trial(5)
      allow(Rails.logger).to receive(:error)

      described_class.allow?(10 * one_credit)

      expect(Rails.logger).to have_received(:error).with(/DAILY CAP REACHED/)
    end

    it "上限 0 以下なら無効（止めない）" do
      allow(described_class).to receive(:daily_cap).and_return(0)
      grant_trial(9_999)

      expect(described_class.allow?(10 * one_credit)).to be(true)
    end
  end

  describe "登録が続いたとき" do
    it "上限に達した時点で、それ以上は配られない" do
      allow(described_class).to receive(:daily_cap).and_return(Billing::Catalog::TRIAL_CREDITS * 3)

      granted = Array.new(5) do
        member = create(:user, :confirmed)
        member.ensure_free_credits!
        member.reload.available_credit_points
      end

      # 3人ぶんまでは配られ、それ以降は 0
      expect(granted.count { |points| points.positive? }).to eq(3)
      expect(granted.last).to eq(0)
    end

    it "配られなかった人にも印は付く（何度も試させない）" do
      allow(described_class).to receive(:allow?).and_return(false)
      member = create(:user, :confirmed)

      member.ensure_free_credits!

      expect(member.reload.trial_granted_at).to be_present
      expect(member.credit_grants).to be_empty
    end
  end
end
