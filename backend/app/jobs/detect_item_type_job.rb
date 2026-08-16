class DetectItemTypeJob < ApplicationJob
  queue_as :default

  # 作成時の種別の自動判定。
  #
  # **利用者が自分で選んだ種別は上書きしない。** 判定は既定のまま作られたカードだけに効かせる。
  # 作ったあとに直した人の選択を、あとから走るジョブが黙って戻してしまわないようにする。
  #
  # 種別は補助情報なので、失敗してもカード自体には影響させない（既定のまま残る）。
  def perform(item_id)
    item = Item.find_by(id: item_id)
    return unless item
    # 既定（単語）のままのものだけを見る。作成時に指定された種別には触らない
    return unless item.item_type&.name == ItemType::DEFAULT_NAME

    result = Cards::DetectItemTypeService.call(title: item.title, user: item.user)
    return if result.item_type.id == item.item_type_id

    # 判定が終わるまでの間に人が直しているかもしれない。**もう一度確かめてから書く**
    updated = Item.where(id: item.id, item_type_id: item.item_type_id)
                  .update_all(item_type_id: result.item_type.id, updated_at: Time.current)
    return if updated.zero?

    Rails.logger.info "[DetectItemTypeJob] item_id=#{item_id} type=#{result.item_type.name}"
  rescue StandardError => e
    Rails.logger.warn "[DetectItemTypeJob] failed item_id=#{item_id}: #{e.class}: #{e.message}"
  end
end
