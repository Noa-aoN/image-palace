require "rails_helper"

RSpec.describe Billing::CreditCost do
  it "returns the base cost (1 credit = POINTS_PER_CREDIT) for a generation" do
    expect(described_class.call(kind: :item_generation)).to eq(Billing::POINTS_PER_CREDIT)
    expect(described_class.call(kind: :point_generation)).to eq(Billing::POINTS_PER_CREDIT)
    expect(described_class.call(kind: :avatar)).to eq(Billing::POINTS_PER_CREDIT)
  end
end
