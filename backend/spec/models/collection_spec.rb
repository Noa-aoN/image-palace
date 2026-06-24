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

    it "View エントリ（デッキ含む）はそのビューの表紙カードをカバー候補に含める" do
      collection = user.collections.create!(name: "C2")
      cover = create(:item, user: user, item_type: item_type, title: "ゼウス")
      view = user.views.create!(name: "神々", view_type: "deck")
      view.view_items.create!(item: cover, position: 1)
      collection.collection_entries.create!(entry_type: "View", entry_id: view.id)

      expect(collection.cover_cards).to include(cover)
    end
  end
end
