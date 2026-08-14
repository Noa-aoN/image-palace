# frozen_string_literal: true

# そのカードで、これまでにどの絵を使ったか。
#
# **絵そのものは増やさない。** 生成した絵は shared_medias に残っている
# （消えないし、強制の作り直しも別の行として積まれる）。
# 失われていたのは「いつ、どれを使ったか」の結びつきだけだった。
class ItemMediaGeneration < ApplicationRecord
  belongs_to :item
  belongs_to :shared_media, class_name: "SharedMedia"

  # 新しく使ったものを上に
  scope :recent, -> { order(used_at: :desc) }

  # 同じ絵に戻したときは行を増やさず、使った時刻だけ新しくする。
  # 行き来するたびに増えると、選ぶ一覧が同じ絵で埋まる
  def self.record!(item:, shared_media:, prompt: nil, model: nil, now: Time.current)
    row = find_or_initialize_by(item_id: item.id, shared_media_id: shared_media.id)
    row.assign_attributes(prompt: prompt.presence || row.prompt, model: model.presence || row.model, used_at: now)
    row.save!
    row
  rescue ActiveRecord::RecordNotUnique
    # 同時に2つ走っても、片方が入っていればよい
    find_by(item_id: item.id, shared_media_id: shared_media.id)
  end
end
