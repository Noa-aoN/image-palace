# frozen_string_literal: true

# キャンバスの状態の控え（配置と線）。AI 調整を戻すために使う。
class ViewRevision < ApplicationRecord
  self.record_timestamps = false

  belongs_to :view

  validates :position, presence: true, uniqueness: { scope: :view_id }

  scope :ordered, -> { order(:position) }
end
