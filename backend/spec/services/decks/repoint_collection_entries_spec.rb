require "rails_helper"

RSpec.describe Decks::RepointCollectionEntries do
  let(:user) { create(:user, :confirmed) }

  it "repoints a Deck collection entry to the migrated deck-view" do
    deck = create(:deck, user:)
    collection = user.collections.create!(name: "コレクション-#{SecureRandom.hex(4)}")
    collection.collection_entries.create!(entry: deck)
    Decks::MigrateToViews.call
    view = View.find_by(source_deck_id: deck.id)

    described_class.call

    entry = collection.collection_entries.first
    expect(entry.entry_type).to eq("View")
    expect(entry.entry_id).to eq(view.id)
  end

  it "removes the Deck entry when a View entry already exists" do
    deck = create(:deck, user:)
    collection = user.collections.create!(name: "コレクション-#{SecureRandom.hex(4)}")
    Decks::MigrateToViews.call
    view = View.find_by(source_deck_id: deck.id)
    collection.collection_entries.create!(entry: view)
    collection.collection_entries.create!(entry_type: "Deck", entry_id: deck.id)

    expect { described_class.call }.to change { collection.collection_entries.count }.by(-1)
    expect(collection.collection_entries.pluck(:entry_type)).to eq([ "View" ])
  end

  it "skips Deck entries without a migrated view" do
    deck = create(:deck, user:)
    collection = user.collections.create!(name: "コレクション-#{SecureRandom.hex(4)}")
    collection.collection_entries.create!(entry: deck)

    result = described_class.call # 移行していないのでスキップ

    expect(result.skipped).to eq(1)
    expect(collection.collection_entries.first.entry_type).to eq("Deck")
  end
end
