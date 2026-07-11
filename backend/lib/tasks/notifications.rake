namespace :notifications do
  # 運営からのお知らせを全ユーザーへ配る。管理画面が無いのでコマンドから配信する。
  # 例: bundle exec rake 'notifications:announce[アップデートのお知らせ,スペース機能を追加しました,/guide]'
  desc "全ユーザーにお知らせを配信する（title, body, url）"
  task :announce, [ :title, :body, :url ] => :environment do |_task, args|
    if args[:title].blank?
      abort "title は必須です。例: rake 'notifications:announce[タイトル,本文,/guide]'"
    end

    count = Notifications::BroadcastService.call(
      title: args[:title],
      body: args[:body].presence,
      url: args[:url].presence
    )

    puts "お知らせを #{count} 人に配信しました: #{args[:title]}"
  end
end
