# frozen_string_literal: true

# 月ごとの請求実額。概算と並べて乖離を見るために入れる。
#
# 概算は単価×回数でしか出せず、単価は外の都合で変わる。実額を入れて乖離率が分かれば、
# 単価を補正できる。これが概算の確度を上げる一番現実的な手段。
class MonthlyActual < ApplicationRecord
  validates :year, numericality: { only_integer: true, greater_than: 2000 }
  validates :month, numericality: { only_integer: true, in: 1..12 }
  validates :year, uniqueness: { scope: :month }
  validates :openai_jpy, :infra_jpy, :other_jpy,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # scope にすると1件返したいのに Relation が返るのでクラスメソッドにする
  def self.for_period(year, month)
    find_by(year: year, month: month)
  end

  def total_jpy
    openai_jpy + infra_jpy + other_jpy
  end
end
