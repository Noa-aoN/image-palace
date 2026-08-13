# frozen_string_literal: true

# AI がまとめた「いまの見立て」。
#
# 管理画面を開くたびには作らない。**明示的に更新したときだけ**作る。
# 出したものは残す。先週何を言ったかが分からないと、同じ指摘を毎週繰り返すことになる。
class AdminBrief < ApplicationRecord
  belongs_to :generated_by, class_name: "User", optional: true
  has_many :admin_insights, -> { order(:position) }, dependent: :destroy, inverse_of: :admin_brief

  scope :recent, -> { order(created_at: :desc) }

  # 直前に作ったばかりなら、それを使い回す。
  # 押し間違いや二度押しで、同じ数字から2つの見立てを作らないため
  RECENT_WINDOW = 1.minute

  def self.recently_generated(now: Time.current)
    recent.find_by(created_at: (now - RECENT_WINDOW)..)
  end
end
