class GenerateTagsJob < ApplicationJob
  queue_as :default

  # 作成時の自動付与用。タグは補助情報のため、失敗してもカード自体には影響させない。
  def perform(item_id)
    item = Item.find_by(id: item_id)
    return unless item

    GenerateTagsService.call(item: item)
    Rails.logger.info "[GenerateTagsJob] generated tags item_id=#{item_id}"
  rescue StandardError => e
    Rails.logger.warn "[GenerateTagsJob] failed item_id=#{item_id}: #{e.class}: #{e.message}"
  end
end
