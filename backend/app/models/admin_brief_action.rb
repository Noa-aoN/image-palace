# frozen_string_literal: true

# 「次にやること」1件。
#
# 見立て（AdminInsight）とは**1対1ではない**。AI は別々に書くので、数も中身も対応しない。
# 見立ての status を「終わったか」に流用すると、
# **AI が何を言ったか**と**人が何をやったか**が混ざる。
#
# 終わったものは消さない。**言われたことをやったかどうか**が、次の見立ての材料になる。
class AdminBriefAction < ApplicationRecord
  belongs_to :admin_brief
  belongs_to :admin_insight, optional: true

  STATUSES = %w[open done].freeze

  validates :title, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :open_ones, -> { where(status: "open") }
  scope :done_ones, -> { where(status: "done") }
  # 新しい見立てのものを上に。同じ見立ての中は書かれた順
  scope :recent, -> { joins(:admin_brief).order("admin_briefs.created_at DESC, admin_brief_actions.position ASC") }

  def done!
    update!(status: "done", completed_at: Time.current)
  end

  def reopen!
    update!(status: "open", completed_at: nil)
  end
end
