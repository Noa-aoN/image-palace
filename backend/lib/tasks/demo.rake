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

    package = ContentPackage.latest_published(Demo::Session::PACKAGE_KEY)
    if package
      c = package.summary_counts
      puts "配っている中身: #{package.name} v#{package.version}"
      puts "  カード #{c[:items]} / 箱 #{c[:boxes]} / キャンバス #{c[:views]}"
    else
      puts "配っている中身: **まだ無い**（この状態では宮殿を建てられない）"
      puts "  bin/rails content:publish KEY=#{Demo::Session::PACKAGE_KEY} KIND=demo ... で用意する"
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
