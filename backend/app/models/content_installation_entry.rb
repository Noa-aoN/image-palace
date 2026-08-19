# frozen_string_literal: true

# 受け取りで生まれた実体（カード・箱・キャンバス）。
#
# 実体の側に列を足していく形にしないのは、
# 種類が増えるたびに全部の表を触ることになるのと、
# **1枚のカードが複数の受け取りから参照される**ことを表せないため。
#
#   荷物A: DNS / ルーター
#   荷物B: DNS / TCP/IP     ← DNS は作り直さず、Aで作ったものを指す
#
# このとき DNS の行は、AとBの両方から1本ずつ生える。
class ContentInstallationEntry < ApplicationRecord
  # 由来を残す種類。ここに無いものは記録しない
  RECORD_TYPES = %w[Item Box View].freeze

  belongs_to :content_installation
  belongs_to :record, polymorphic: true

  validates :record_type, inclusion: { in: RECORD_TYPES }
  validates :record_id, uniqueness: { scope: [ :content_installation_id, :record_type ] }

  scope :items, -> { where(record_type: "Item") }

  # そのカード・箱・キャンバスが公式由来か
  def self.official?(record)
    exists?(record_type: record.class.name, record_id: record.id)
  end
end
