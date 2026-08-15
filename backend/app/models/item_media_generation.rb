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

  # いまの見出し語で作ったものだけ。
  #
  # **見出し語を変えたら、前の語で作った絵は選べない。** 残しておくと、
  # 1枚のカードで語を書き換えながら絵を集め、あとから好きなものを選び直せてしまう。
  # 語と絵の結びつきが崩れ、「その語の絵」という前提が成り立たなくなる。
  #
  # 語を記録していない古い行は選べる側に倒す。
  # **後から入れた決まりで、過去に作った絵を取り上げない**
  scope :for_title, ->(title) { where(item_title: [ nil, title ]) }

  # 同じ絵に戻したときは行を増やさず、使った時刻だけ新しくする。
  # 行き来するたびに増えると、選ぶ一覧が同じ絵で埋まる
  def self.record!(item:, shared_media:, prompt: nil, model: nil, now: Time.current)
    row = find_or_initialize_by(item_id: item.id, shared_media_id: shared_media.id)
    row.assign_attributes(prompt: prompt.presence || row.prompt, model: model.presence || row.model,
                          # どの語で作ったか。あとで「いまの語のものだけ」を選ぶのに使う
                          item_title: item.title, used_at: now)
    row.save!
    row
  rescue ActiveRecord::RecordNotUnique
    # 同時に2つ走っても、片方が入っていればよい
    find_by(item_id: item.id, shared_media_id: shared_media.id)
  end
end
