# frozen_string_literal: true

# 工房室まわりの手仕事。
#
# **どれも本番で走らせる前提**なので、何をするかを必ず先に出す。
namespace :studio do
  desc "残っている下見を片付ける（実体ごと）"
  task discard_previews: :environment do
    rows = ContentInstallation.where(source: ContentInstallation::PREVIEW_SOURCE)
                              .includes(:user).order(:installed_at)

    if rows.empty?
      puts "残っている下見はありません"
      next
    end

    puts "片付ける下見:"
    rows.each do |row|
      puts "  #{row.user&.email} / #{row.package_key} v#{row.package_version}" \
           " / #{row.installed_at} / 実体 #{row.entries.count}"
    end

    users = rows.map(&:user).compact.uniq
    before = users.to_h { |u| [ u.email, [ u.items.count, u.boxes.count, u.views.count ] ] }

    users.each { |user| Studio::Preview.discard!(user) }

    puts
    users.each do |user|
      after = [ user.reload.items.count, user.boxes.count, user.views.count ]
      puts "  #{user.email}: カード #{before[user.email][0]} → #{after[0]}" \
           " / 箱 #{before[user.email][1]} → #{after[1]}" \
           " / キャンバス #{before[user.email][2]} → #{after[2]}"
    end
    puts "残った下見: #{ContentInstallation.where(source: ContentInstallation::PREVIEW_SOURCE).count}"
  end

  desc "下見の様子を見る（消さない）"
  task previews: :environment do
    rows = ContentInstallation.where(source: ContentInstallation::PREVIEW_SOURCE)
                              .includes(:user).order(:installed_at)
    puts "下見: #{rows.count} 件"
    rows.each do |row|
      stale = Studio::Preview.expired?(row) ? "（寿命切れ）" : ""
      puts "  #{row.user&.email} / #{row.package_key} v#{row.package_version}" \
           " / #{row.installed_at}#{stale} / 実体 #{row.entries.count}"
    end
  end
end
