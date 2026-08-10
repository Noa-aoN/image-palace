# frozen_string_literal: true

# 実績の進み具合。達成したら completed_at が入り、以後は動かさない。
class UserAchievement < ApplicationRecord
  belongs_to :user
  belongs_to :achievement_definition

  validates :achievement_definition_id, uniqueness: { scope: :user_id }

  scope :completed, -> { where.not(completed_at: nil) }

  def completed?
    completed_at.present?
  end
end
