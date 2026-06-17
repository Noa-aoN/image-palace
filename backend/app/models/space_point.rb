class SpacePoint < ApplicationRecord
  belongs_to :space
  # 空ポイントを許容（カード未割当）
  belongs_to :item, optional: true
  # ポイント名から生成するポイント自身のイメージ画像
  has_one_attached :image

  GENERATION_STATUSES = %w[pending processing completed failed].freeze
  GENERATION_ERROR_KEYS = %w[generation_error generation_error_code].freeze
  NAME_MAX_LENGTH = 100

  store_accessor :metadata, :generation_error, :generation_error_code, :revised_prompt

  validates :position, presence: true, numericality: { only_integer: true }
  validates :name, length: { maximum: NAME_MAX_LENGTH }, allow_blank: true
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :ordered, -> { order(:position, :created_at) }
  # 名前が付いた（＝画像生成を伴う）ポイント。月間生成上限のカウント対象。
  scope :named, -> { where.not(name: [ nil, "" ]) }
  scope :created_this_month, -> { where(created_at: Time.current.beginning_of_month..) }

  def metadata_without_generation_error
    (metadata || {}).except(*GENERATION_ERROR_KEYS)
  end

  def update_generation_status!(status)
    update!(generation_status: status, metadata: metadata_without_generation_error)
  end

  def mark_generation_failed!(message:, code: nil)
    update!(
      generation_status: "failed",
      metadata: metadata_without_generation_error.merge(
        "generation_error" => message,
        "generation_error_code" => code
      ).compact
    )
  end
end
