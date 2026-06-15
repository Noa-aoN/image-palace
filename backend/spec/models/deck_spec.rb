require "rails_helper"

RSpec.describe Deck, type: :model do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def item(title)
    user.items.create!(title: title, item_type: item_type, generation_status: "completed")
  end

  it "cover_type の既定は first_card" do
    expect(create(:deck, user: user).cover_type).to eq("first_card")
  end

  it "不正な cover_type を弾く" do
    deck = build(:deck, user: user, cover_type: "bogus")
    expect(deck).not_to be_valid
  end

  describe "#cover_cards" do
    it "追加順（deck_items.created_at 昇順）で返す" do
      deck = user.decks.create!(name: "d")
      a = item("a")
      b = item("b")
      deck.deck_items.create!(item: a, created_at: 3.minutes.ago)
      deck.deck_items.create!(item: b, created_at: 1.minute.ago)

      expect(deck.cover_cards.map(&:id)).to eq([ a.id, b.id ])
    end

    it "cover_item を先頭にする" do
      deck = user.decks.create!(name: "d")
      a = item("a")
      b = item("b")
      c = item("c")
      deck.deck_items.create!(item: a, created_at: 3.minutes.ago)
      deck.deck_items.create!(item: b, created_at: 2.minutes.ago)
      deck.deck_items.create!(item: c, created_at: 1.minute.ago)
      deck.update!(cover_item_id: c.id)

      expect(deck.cover_cards.map(&:id)).to eq([ c.id, a.id, b.id ])
    end

    it "上限（COVER_CARDS_LIMIT）で切り詰める" do
      deck = user.decks.create!(name: "d")
      (Deck::COVER_CARDS_LIMIT + 2).times do |i|
        deck.deck_items.create!(item: item("t#{i}"), created_at: (60 - i).minutes.ago)
      end

      expect(deck.cover_cards.size).to eq(Deck::COVER_CARDS_LIMIT)
    end
  end
end
