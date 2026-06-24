# frozen_string_literal: true

module Decks
  # デッキ移行(MigrateToViews)後に、collection_entries の 'Deck' エントリを
  # 対応する deck-view('View') へ付け替える（Phase B-3b-2 の活性化）。
  # 冪等：移行済み(source_deck_id 一致)の View が無い Deck エントリはスキップ。
  class RepointCollectionEntries
    Result = Struct.new(:repointed, :removed_duplicates, :skipped, keyword_init: true)

    def self.call(...)
      new(...).call
    end

    def initialize(logger: nil)
      @logger = logger
    end

    def call
      repointed = 0
      removed = 0
      skipped = 0

      CollectionEntry.where(entry_type: "Deck").find_each do |entry|
        view = View.find_by(source_deck_id: entry.entry_id)
        unless view
          skipped += 1
          next
        end

        if CollectionEntry.exists?(collection_id: entry.collection_id, entry_type: "View", entry_id: view.id)
          # 既に同じ View エントリがある → 重複の Deck エントリを削除
          entry.destroy!
          removed += 1
        else
          entry.update!(entry_type: "View", entry_id: view.id)
          repointed += 1
          log("collection_entry #{entry.id} Deck -> View(#{view.id})")
        end
      end

      Result.new(repointed:, removed_duplicates: removed, skipped:)
    end

    private

    def log(message)
      @logger&.call(message)
    end
  end
end
