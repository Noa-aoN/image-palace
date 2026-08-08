# frozen_string_literal: true

# 画像生成の実回数。原価の概算に使う。
#
# 文章側の AiUsage と対。あちらはトークン数まで持てるが、画像は枚数と条件（モデル・
# サイズ・品質）で値段が決まるのでそれを残す。
class ImageUsage < ApplicationRecord
  # 生成の入口。どこで使われているかが分かると、原価の内訳を機能別に見られる
  KINDS = %w[item avatar cover point unknown].freeze

  validates :kind, :provider, :model, presence: true

  scope :since, ->(time) { where(created_at: time..) }
  scope :between, ->(from, to) { where(created_at: from...to) }

  # 記録に失敗しても生成そのものは止めない（原価の集計より、絵が出ることを優先する）
  def self.record!(kind:, provider:, model:, size: nil, quality: nil, user_id: nil)
    create!(
      kind: KINDS.include?(kind.to_s) ? kind.to_s : "unknown",
      provider: provider.to_s,
      model: model.to_s,
      size: size,
      quality: quality,
      user_id: user_id
    )
  rescue StandardError => e
    Rails.logger.warn "[ImageUsage] 記録に失敗しました #{e.class}: #{e.message}"
    nil
  end
end
