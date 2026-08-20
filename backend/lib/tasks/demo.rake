# frozen_string_literal: true

# 体験用の宮殿の運用。
#
# **ここには処理を書かない。** 中身は `Demo::Session` にあり、
# rake は呼ぶだけ。運営が手元から状態を見て、片付けられれば足りる。
#
#   bin/rails demo:status
#   bin/rails demo:sweep
#   bin/rails demo:clear          # 全部消す（止めたいとき）
namespace :demo do
  desc "いまの体験用の宮殿の様子"
  task status: :environment do
    living = User.demo_accounts.where(created_at: (Time.current - Demo::Session::LIFETIME)..)
    expired = User.demo_accounts.where(created_at: ...(Time.current - Demo::Session::LIFETIME))
    today = User.demo_accounts.where(created_at: Time.current.beginning_of_day..)

    puts "立っている宮殿: #{living.count} / 上限 #{Demo::Session::CONCURRENT_CAP}"
    puts "今日ぶん      : #{today.count} / 上限 #{Demo::Session::DAILY_CAP}"
    puts "寿命切れ      : #{expired.count}（次の片付けで消える）"
    puts "寿命          : #{Demo::Session::LIFETIME.inspect}"
    puts

    packages = Demo::Session.packages
    if packages.any?
      puts "体験の宮殿に置いているもの: #{packages.size} 件 / カード #{packages.sum { |p| p.summary_counts[:items] }}"
      packages.each { |p| puts "  #{p.name}（#{p.key} v#{p.version}）" }
    else
      puts "体験の宮殿に置いているもの: **まだ無い**（この状態では宮殿を建てられない）"
      puts "  工房室で、荷物の届け先に「体験の宮殿に置く」を入れる"
    end
  end

  desc "寿命の切れた宮殿を片付ける"
  task sweep: :environment do
    puts "片付けた宮殿: #{Demo::Session.sweep!}"
  end

  desc "体験用の宮殿を全部消す（配るのを止めたいとき）"
  task clear: :environment do
    count = User.demo_accounts.count
    User.demo_accounts.find_each(&:destroy!)
    puts "消した宮殿: #{count}"
  end
end
