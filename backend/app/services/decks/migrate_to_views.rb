# frozen_string_literal: true

module Decks
  # 既存 Deck を view_type='deck' の View へ移行する（Phase B-2・追加のみ）。
  # 冪等：source_deck_id で移行済みを判定しスキップする。
  # この段階では collection_entries の付け替えや decks 削除は行わない（B3/B4）。
  class MigrateToViews
    Result = Struct.new(:migrated, :skipped, keyword_init: true)

    def self.call(...)
      new(...).call
    end

    def initialize(logger: nil)
      @logger = logger
    end

    def call
      migrated = 0
      skipped = 0

      Deck.find_each do |deck|
        if View.exists?(source_deck_id: deck.id)
          skipped += 1
          next
        end
        migrate_deck(deck)
        migrated += 1
        log("deck #{deck.id} (#{deck.name}) -> deck-view")
      end

      Result.new(migrated:, skipped:)
    end

    private

    def migrate_deck(deck)
      ActiveRecord::Base.transaction do
        view = View.create!(
          user_id: deck.user_id,
          name: deck.name,
          view_type: "deck",
          cover_type: deck.cover_type,
          cover_item_id: deck.cover_item_id,
          source_deck_id: deck.id
        )

        ordered_deck_items(deck).each_with_index do |deck_item, index|
          # deck の view_item は順序のみ意味を持つ（x/y/z_index は既定 0）。
          view.view_items.create!(item_id: deck_item.item_id, position: index + 1, x: 0, y: 0, z_index: 0)
        end

        copy_cover_image(deck, view)
      end
    end

    def ordered_deck_items(deck)
      deck.deck_items.order(Arel.sql("position ASC NULLS LAST, created_at ASC"))
    end

    # cover_image（custom カバー）は同じ blob を view にも添付して共有する。
    # 撤去(B4)では blob を消さないよう deck 側を detach する。
    def copy_cover_image(deck, view)
      return unless deck.cover_image.attached?

      view.cover_image.attach(deck.cover_image.blob)
    end

    def log(message)
      @logger&.call(message)
    end
  end
end
