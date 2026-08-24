class Notification < ApplicationRecord
  # 通知の種別。将来アゴラ（共有）や運営のアップデート情報を足すときは、ここに追加する。
  KINDS = %w[
    item_generation_completed
    item_generation_failed
    announcement
    credits_expiring
    reward_granted
    achievement_completed
    mission_completed
  ].freeze

  belongs_to :user

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :title, presence: true

  scope :unread, -> { where(read_at: nil) }
  # 最後に id を置いて、同着の順を決め切る。
  # お知らせは一括で作られるため作成時刻が揃いやすく、同着のままページを送ると、
  # **同じお知らせが2ページに出て、別のお知らせがどこにも出ない**ことが起こる
  # （カード一覧で実際に起きた。#630 で同じ手当てをしている）
  scope :recent, -> { order(created_at: :desc, id: :desc) }

  def read?
    read_at.present?
  end

  def mark_read!
    return if read?

    update!(read_at: Time.current)
  end
end
