require "rails_helper"

RSpec.describe Collection, type: :model do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  describe "#cover_cards" do
    it "Item エントリのカードをカバー候補に含める" do
      collection = user.collections.create!(name: "C1")
      item = create(:item, user: user, item_type: item_type, title: "単語")
      collection.collection_entries.create!(entry_type: "Item", entry_id: item.id)

      expect(collection.cover_cards).to include(item)
    end

    it "Deck エントリはそのデッキの表紙カードをカバー候補に含める（中身がデッキだけでも反映）" do
      collection = user.collections.create!(name: "C2")
      cover = create(:item, user: user, item_type: item_type, title: "ゼウス")
      deck = user.decks.create!(name: "神々")
      deck.deck_items.create!(item: cover)
      collection.collection_entries.create!(entry_type: "Deck", entry_id: deck.id)

      expect(collection.cover_cards).to include(cover)
    end
  end
end
