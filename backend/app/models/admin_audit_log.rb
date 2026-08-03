# frozen_string_literal: true

# 管理操作の記録。追記のみ。
class AdminAuditLog < ApplicationRecord
  self.record_timestamps = false

  belongs_to :actor, class_name: "User", optional: true

  validates :action, presence: true

  scope :recent, -> { order(created_at: :desc) }

  # 記録に失敗しても操作そのものは止めない（記録のために機能を止めない）。
  # ただし黙って消さず、ログには必ず残す。
  def self.record!(actor:, action:, target: nil, details: {})
    create!(
      actor: actor,
      actor_email: actor&.email,
      action: action,
      target_type: target&.class&.name,
      target_id: target&.id,
      details: details,
      created_at: Time.current
    )
  rescue StandardError => e
    Rails.logger.error "[AdminAuditLog] RECORD FAILED action=#{action} #{e.class}: #{e.message}"
    nil
  end
end
