# frozen_string_literal: true

# ミッションの進み具合。繰り返すものは期間ごとに別の行になる。
class UserMission < ApplicationRecord
  belongs_to :user
  belongs_to :mission_definition

  validates :period_key, presence: true
  validates :mission_definition_id, uniqueness: { scope: [ :user_id, :period_key ] }

  scope :completed, -> { where.not(completed_at: nil) }

  def completed?
    completed_at.present?
  end
end
