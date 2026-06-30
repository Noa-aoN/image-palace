require "rails_helper"

RSpec.describe ExpireCreditGrantsJob, type: :job do
  let(:user) { create(:user, :confirmed) }

  it "期限切れのグラントを失効させ grant_expire を台帳に記録する" do
    user.grant_credits!(500, kind: "campaign", expires_at: 1.day.from_now)
    grant = user.credit_grants.last
    grant.update_column(:expires_at, 1.day.ago) # rubocop:disable Rails/SkipsModelValidations

    expect { described_class.perform_now }
      .to change { grant.reload.remaining_points }.from(500).to(0)

    expire = user.credit_transactions.where(kind: "grant_expire").last
    expect(expire.delta).to eq(-500)
  end

  it "未期限切れ・期限なしのグラントは触らない" do
    user.grant_credits!(200, kind: "campaign", expires_at: 10.days.from_now)
    user.grant_credits!(100, kind: "goodwill", expires_at: nil)

    expect { described_class.perform_now }.not_to(change { user.reload.grant_credit_points })
  end
end
