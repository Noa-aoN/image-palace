class GenerateMeaningJob < ApplicationJob
  queue_as :default

  # 作成時の自動生成用。意味生成は補助情報のため、失敗してもカード自体には影響させない。
  def perform(item_id, level = Meaning::DEFAULT_DETAIL_LEVEL)
    item = Item.find_by(id: item_id)
    return unless item

    GenerateMeaningService.call(item: item, level: level)
    Rails.logger.info "[GenerateMeaningJob] generated meaning item_id=#{item_id} level=#{level}"
  rescue StandardError => e
    Rails.logger.warn "[GenerateMeaningJob] failed item_id=#{item_id}: #{e.class}: #{e.message}"
  end
end
