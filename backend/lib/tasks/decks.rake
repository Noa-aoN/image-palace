# frozen_string_literal: true

namespace :decks do
  desc "既存デッキを view_type='deck' のビューへ移行する（Phase B-2・冪等・追加のみ）"
  task migrate_to_views: :environment do
    result = Decks::MigrateToViews.call(logger: ->(msg) { puts msg })
    puts "done. migrated=#{result.migrated} skipped=#{result.skipped}"
  end

  desc "デッキ→ビュー移行 ＋ collection_entries 付け替えを一括実行（Phase B-3b-2 活性化・冪等）"
  task cutover: :environment do
    migration = Decks::MigrateToViews.call(logger: ->(msg) { puts msg })
    puts "migrated=#{migration.migrated} skipped=#{migration.skipped}"
    repoint = Decks::RepointCollectionEntries.call(logger: ->(msg) { puts msg })
    puts "repointed=#{repoint.repointed} removed_duplicates=#{repoint.removed_duplicates} skipped=#{repoint.skipped}"
  end
end
