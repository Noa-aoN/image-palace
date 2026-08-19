# 寿命の切れた体験用の宮殿を片付ける。
#
# **1時間おきに呼ぶ。** まとめて1日1回にすると、
# 1回の削除量が大きくなって本番の DB に効いてしまう。
#
# `dependent: :destroy` が張ってあるので、口座を消せば
# カード・箱・キャンバス・宮殿まで一緒に落ちる。
# 共有している絵（`shared_media` の blob）は残るので、次の複製がまたそれを使う。
class DemoCleanupJob < ApplicationJob
  queue_as :default

  def perform
    count = Demo::Session.sweep!
    Rails.logger.info "[DemoCleanupJob] 片付けた宮殿: #{count}" if count.positive?
    count
  end
end
