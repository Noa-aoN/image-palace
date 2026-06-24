require "rails_helper"

RSpec.describe View, type: :model do
  it "accepts the deck view_type" do
    view = build(:view, view_type: "deck")
    expect(view).to be_valid
    expect(view.deck?).to be(true)
  end

  it "rejects an unknown view_type" do
    expect(build(:view, view_type: "weird")).not_to be_valid
  end

  it "keeps deck card order via view_items.position" do
    view = create(:view, view_type: "deck")
    first = create(:item)
    second = create(:item)
    create(:view_item, view:, item: second, position: 2)
    create(:view_item, view:, item: first, position: 1)

    ordered = view.view_items.order(:position).map(&:position)
    expect(ordered).to eq([ 1, 2 ])
  end
end
