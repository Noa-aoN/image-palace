# frozen_string_literal: true

# カードを1回確認した記録。
#
# 導出値（習熟度・次回の出題日）は持たない。決め方がまだ定まっていないので、
# 生の記録だけ残す。集計はいつでもここから出し直せる。
class ItemReview < ApplicationRecord
  belongs_to :user
  belongs_to :item

  # 正誤の分かる出題（correct / incorrect）と、見返しただけ（seen）を区別する。
  # 見返しは「触れた」記録であって、覚えているかの証拠にはならない
  RESULTS = %w[correct incorrect seen].freeze
  MODES = %w[practice quiz game].freeze

  validates :result, inclusion: { in: RESULTS }
  validates :mode, inclusion: { in: MODES }
  validates :reviewed_at, presence: true

  scope :recent_first, -> { order(reviewed_at: :desc, created_at: :desc) }
  scope :graded, -> { where(result: %w[correct incorrect]) }

  # カード1枚ぶんの集計。詳細画面に出す。
  # 正答率は「正誤の付いた回」だけで出す。見返しを混ぜると、
  # 見返すほど率が下がる（または上がる）ことになって意味を成さない。
  def self.summarize(scope, recent: 5)
    graded_reviews = scope.graded.recent_first.limit(recent).to_a
    {
      count: scope.count,
      last_reviewed_at: scope.recent_first.first&.reviewed_at,
      recent_graded_count: graded_reviews.size,
      recent_correct_count: graded_reviews.count { |r| r.result == "correct" }
    }
  end
end
