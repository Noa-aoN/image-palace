# frozen_string_literal: true

# その人が活動した日。**1人1日1行だけ**。
#
# 継続率（D1 / D7 / D30）と、来訪の推移を出すための土台。
# `users.last_seen_at` は「最後に来た日」1点しか持たないので、
# 「先週来ていた人が今週も来たか」を後から作れない。
#
# 残すのは「誰が・どの日に」だけ。URL も操作の中身も IP も端末も持たない。
# 継続率に要らないものを持つと、要らないものを守る責任だけが増える。
class UserActivityDay < ApplicationRecord
  belongs_to :user

  # その日はじめての1回だけ行が入る。2回目以降は何も起きない。
  # 同時に来ても重複しない（一意の索引が弾く）ので、ロックを取らない。
  def self.record!(user_id, on_date = Time.zone.today)
    insert_all(
      [ { user_id: user_id, on_date: on_date, created_at: Time.current } ],
      unique_by: %i[user_id on_date]
    )
  end

  # 測り始めた日。**記録から導かない。**
  #
  # 「最初の行が入った日」にすると、
  #   - 誰も来なかった日が計測前だったことになる（来なかったことも観測結果なのに）
  #   - いちばん古い行を持つ人が退会すると、開始日が動く
  # という具合に、同じ過去を見ているのに答えが変わってしまう。
  #
  # ここは「正しく観測できるようになった日」＝この仕組みを本番へ入れた日で固定する。
  # 動かすときは、なぜ動かすのかが説明できるときだけ。
  MEASUREMENT_STARTED_ON = Date.new(2026, 8, 13)

  def self.measurement_started_on
    MEASUREMENT_STARTED_ON
  end
end
