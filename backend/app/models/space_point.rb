class SpacePoint < ApplicationRecord
  belongs_to :space
  # 空ポイントを許容（カード未割当）
  belongs_to :item, optional: true
  # ポイント名から生成するポイント自身のイメージ画像
  has_one_attached :image
  # 一覧用サムネ（480px WebP）。CDN 直配信のため生成時に事前作成する。
  has_one_attached :thumb

  GENERATION_STATUSES = %w[pending processing completed failed].freeze
  GENERATION_ERROR_KEYS = %w[generation_error generation_error_code].freeze
  NAME_MAX_LENGTH = 100

  # 多面ルームの面（床・天井・4壁）。room の点はどれか1面に属し、面内 (u,v)∈[0,1] に配置する。
  SURFACES = %w[floor ceiling wall_north wall_east wall_south wall_west].freeze

  store_accessor :metadata, :generation_error, :generation_error_code, :revised_prompt

  before_validation :clamp_uv
  before_validation :normalize_rotation

  validates :position, presence: true, numericality: { only_integer: true }
  validates :name, length: { maximum: NAME_MAX_LENGTH }, allow_blank: true
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :surface, inclusion: { in: SURFACES }
  validates :u, :v, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }
  validates :scale, numericality: { greater_than_or_equal_to: 0.3, less_than_or_equal_to: 3.0 }
  # 回転は正規化して -180 以上 180 未満に収まる（値域外はここに来る前に畳まれる）
  validates :rotation_x, :rotation_y, :rotation_z,
            numericality: { greater_than_or_equal_to: -180, less_than: 180 }

  scope :ordered, -> { order(:position, :created_at) }
  # 名前が付いた（＝画像生成を伴う）ポイント。月間生成上限のカウント対象。
  scope :named, -> { where.not(name: [ nil, "" ]) }
  scope :created_this_month, -> { where(created_at: Time.current.beginning_of_month..) }

  # 生成が pending/processing のまま滞留している孤児候補（Item.stuck_generation と同義）。
  # デプロイ/再起動で GeneratePointImageJob が pruned されると発生する。
  # 空ポイント（name 無し）は生成対象外なので、呼び出し側で named と併用する。
  scope :stuck_generation, ->(cutoff) {
    where(generation_status: %w[pending processing]).where(updated_at: ..cutoff)
  }

  def metadata_without_generation_error
    (metadata || {}).except(*GENERATION_ERROR_KEYS)
  end

  # 面内座標は 0..1 に、表示倍率は 0.3..3.0 に収める。
  def clamp_uv
    self.u = u.clamp(0.0, 1.0) unless u.nil?
    self.v = v.clamp(0.0, 1.0) unless v.nil?
    self.scale = scale.clamp(0.3, 3.0) unless scale.nil?
  end

  # 回転（度）は一周で畳む。370 度と 10 度が別値として保存されるのを防ぐ。
  def normalize_rotation
    %i[rotation_x rotation_y rotation_z].each do |attr|
      value = self[attr]
      next if value.nil?

      self[attr] = value.to_f.remainder(360).then { |v| v >= 180 ? v - 360 : (v < -180 ? v + 360 : v) }
    end
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
