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

  # 測り始めた日。これより前は「未計測」であって 0 ではない
  def self.measurement_started_on
    minimum(:on_date)
  end
end
