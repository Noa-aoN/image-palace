# frozen_string_literal: true

# カバー画像を AI で作れるレコード（キャンバス／スペース／ボックス）に共通の状態。
#
# 生成は非同期なので、いまどこまで進んだかと、駄目だったときの理由を持つ。
# アバター（User）と同じ考え方だが、こちらは複数のモデルで共有するため concern にする。
module CoverGeneratable
  extend ActiveSupport::Concern

  COVER_GENERATION_STATUSES = %w[pending processing completed failed].freeze
  # 生成中とみなす状態（フロントはこの間だけ取り直す）
  COVER_GENERATION_PENDING = %w[pending processing].freeze

  included do
    validates :cover_generation_status,
              inclusion: { in: COVER_GENERATION_STATUSES }, allow_nil: true
  end

  def cover_generating?
    COVER_GENERATION_PENDING.include?(cover_generation_status)
  end

  def update_cover_generation_status!(status)
    update!(cover_generation_status: status, cover_generation_error: nil)
  end

  def mark_cover_generation_failed!(message)
    update!(cover_generation_status: "failed", cover_generation_error: message)
  end
end
