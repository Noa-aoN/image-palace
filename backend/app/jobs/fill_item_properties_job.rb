# カード作成時に、項目（読み仮名・別名など）をまとめて埋める。
#
# **1回の呼び出しで全部**埋める（Items::FillPropertiesService）。項目ごとに呼ぶと、
# 3つ選んだ人は1枚のカードで3回 AI を叩くことになる。
#
# 埋めるのは空いている項目だけ。手で書いたものは触らない。
# 補助情報なので、失敗してもカード自体には影響させない。
class FillItemPropertiesJob < ApplicationJob
  queue_as :default

  def perform(item_id, keys = nil)
    item = Item.find_by(id: item_id)
    return unless item

    result = Items::FillPropertiesService.call(item: item, keys: keys.presence, only_blank: true)
    Rails.logger.info "[FillItemPropertiesJob] filled item_id=#{item_id} keys=#{result.filled_keys.inspect}"
  rescue StandardError => e
    Rails.logger.warn "[FillItemPropertiesJob] failed item_id=#{item_id}: #{e.class}: #{e.message}"
  end
end
