# 「枚数に比例して問い合わせが増えないか」を見張るための道具。
#
# 速さそのものは環境で変わるので測らない。**問い合わせの本数**だけを数える。
# 本番の DB は隣の部屋には無いので（Fly sin ↔ Neon）、本数がそのまま待ち時間になる。
#
# 4つの spec がそれぞれ同じ定数と同じ数え方を持っていて、
# 読み込み順によっては「定数を上書きした」と警告が出ていた。1か所に寄せる。
module QueryCounting
  # 認証まわりは数えない。devise-token-auth はトークンを一定の窓でまとめて
  # 更新するので、同じ操作でも users への問い合わせが1本増えたり減ったりする。
  # 見たいのは「件数に比例して増えるか」だけなので、揺れる分を外す
  AUTH_TABLES = /"(users|settings)"/

  def count_queries
    count = 0
    sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      next if payload[:name].to_s.match?(/SCHEMA|TRANSACTION/)
      next if payload[:sql].to_s.match?(AUTH_TABLES)

      count += 1
    end
    yield
    count
  ensure
    ActiveSupport::Notifications.unsubscribe(sub)
  end
end

RSpec.configure do |config|
  config.include QueryCounting, type: :request
end
