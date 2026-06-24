require "rails_helper"

RSpec.describe Decks::MigrateToViews do
  let(:user) { create(:user, :confirmed) }

  it "creates a deck-view with view_items ordered by deck position" do
    deck = create(:deck, user:, name: "英単語")
    first = create(:item, user:)
    second = create(:item, user:)
    deck.deck_items.create!(item: second, position: 2)
    deck.deck_items.create!(item: first, position: 1)

    expect { described_class.call }.to change { View.where(view_type: "deck").count }.by(1)

    view = View.find_by(source_deck_id: deck.id)
    expect(view.name).to eq("英単語")
    expect(view.user_id).to eq(user.id)
    expect(view.view_items.order(:position).map(&:item_id)).to eq([ first.id, second.id ])
  end

  it "is idempotent (re-running skips already-migrated decks)" do
    create(:deck, user:)

    described_class.call
    result = described_class.call

    expect(result.migrated).to eq(0)
    expect(View.where(view_type: "deck").count).to eq(1)
  end

  it "copies the cover settings to the view" do
    item = create(:item, user:)
    deck = create(:deck, user:, cover_item: item, cover_type: "custom")
    deck.deck_items.create!(item:, position: 1)

    described_class.call

    view = View.find_by(source_deck_id: deck.id)
    expect(view.cover_item_id).to eq(item.id)
    expect(view.cover_type).to eq("custom")
  end
end
