class Notification < ApplicationRecord
  # 通知の種別。将来アゴラ（共有）や運営のアップデート情報を足すときは、ここに追加する。
  KINDS = %w[
    item_generation_completed
    item_generation_failed
    announcement
  ].freeze

  belongs_to :user

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :title, presence: true

  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc) }

  def read?
    read_at.present?
  end

  def mark_read!
    return if read?

    update!(read_at: Time.current)
  end
end
