# frozen_string_literal: true

namespace :tags do
  desc "既存ユーザー全員にデフォルトタグ（Tag::DEFAULT_TAGS）をバックフィルする（冪等）"
  task backfill_defaults: :environment do
    count = 0
    User.find_each do |user|
      Tag.assign_defaults_to(user)
      count += 1
    end
    puts "done. backfilled default tags for #{count} users"
  end
end
