# frozen_string_literal: true

namespace :decks do
  desc "既存デッキを view_type='deck' のビューへ移行する（Phase B-2・冪等・追加のみ）"
  task migrate_to_views: :environment do
    result = Decks::MigrateToViews.call(logger: ->(msg) { puts msg })
    puts "done. migrated=#{result.migrated} skipped=#{result.skipped}"
  end
end
