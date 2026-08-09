# frozen_string_literal: true

# 画像生成の回数。原価の概算と、利用者への「何を作ったか」の提示に使う。
#
# 文章側の AiUsage と対。あちらはトークン数まで持てるが、画像は枚数と条件（モデル・
# サイズ・品質）で値段が決まるのでそれを残す。
#
# cached = キャッシュで済んだぶん。**クレジットは同じだけ消費している**ので回数には数えるが、
# API を呼んでいないので原価には数えない。集計する側がどちらの目的かで使い分けること。
class ImageUsage < ApplicationRecord
  # 生成の入口。どこで使われているかが分かると、原価の内訳を機能別に見られる
  KINDS = %w[item avatar cover point unknown].freeze

  # 利用者に見せるときのラベル
  LABELS = {
    "item" => "カードの画像",
    "avatar" => "プロフィール画像",
    "cover" => "ヘッダー画像",
    "point" => "スペースの点の画像",
    "unknown" => "その他"
  }.freeze

  validates :kind, :provider, :model, presence: true

  scope :since, ->(time) { where(created_at: time..) }
  scope :between, ->(from, to) { where(created_at: from...to) }
  # 原価が掛かったぶんだけ。収支の集計はこちらを使う
  scope :billed, -> { where(cached: false) }

  def self.label_for(kind)
    LABELS[kind] || kind
  end

  # 記録に失敗しても生成そのものは止めない（原価の集計より、絵が出ることを優先する）
  def self.record!(kind:, provider:, model:, size: nil, quality: nil, user_id: nil, cached: false)
    create!(
      kind: KINDS.include?(kind.to_s) ? kind.to_s : "unknown",
      provider: provider.to_s,
      model: model.to_s,
      size: size,
      quality: quality,
      user_id: user_id,
      cached: cached
    )
  rescue StandardError => e
    Rails.logger.warn "[ImageUsage] 記録に失敗しました #{e.class}: #{e.message}"
    nil
  end
end
