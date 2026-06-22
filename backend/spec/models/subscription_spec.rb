require "rails_helper"

RSpec.describe Subscription, type: :model do
  it "is valid with a known status" do
    expect(build(:subscription, status: "active")).to be_valid
  end

  it "rejects an unknown status" do
    expect(build(:subscription, status: "weird")).not_to be_valid
  end

  it "exposes the active scope and predicate" do
    active = create(:subscription, status: "active")
    create(:subscription, status: "canceled")

    expect(described_class.active).to contain_exactly(active)
    expect(active.active?).to be(true)
  end
end
