class Space < ApplicationRecord
  include CoverGeneratable
  belongs_to :user
  has_many :space_boxes, dependent: :destroy
  has_many :boxes, through: :space_boxes
  has_many :space_points, dependent: :destroy
  has_many :box_entries, as: :entry, dependent: :destroy
  # カバー（デッキ踏襲）。カバー候補はポイントの生成画像。表紙は SpacePoint を指定。
  belongs_to :cover_space_point, class_name: "SpacePoint", optional: true
  has_one_attached :cover_image
  # 一覧用サムネ（480px WebP）。CDN 直配信のためアップロード時に作成する。
  has_one_attached :cover_thumb

  NAME_MAX_LENGTH = 100
  # room（棚＝コレクションを並べる） / road（連結法＝序数ポイントにカードを置く）
  SPACE_TYPES = %w[room road].freeze
  COVER_TYPES = %w[first_card collage custom].freeze
  COVER_CARDS_LIMIT = 8
  # 部屋の寸法（メートル相当）の許容範囲
  DIMENSION_MIN = 1.5
  DIMENSION_MAX = 20.0
  HEIGHT_MIN = 2.0
  HEIGHT_MAX = 8.0

  # 部屋の見た目のプリセット。実際の配色はフロント（lib/room-style.ts）が持ち、
  # ここではキーの妥当性だけを担保する（2D/3D の描画で同じ定義を使うため）。
  ROOM_STYLES = %w[ivory concrete wood dark].freeze
  # プリセットを個別に上書きできる項目
  STYLE_COLOR_KEYS = %w[floor_color wall_color ceiling_color edge_color background_color grid_color].freeze
  STYLE_OVERRIDE_KEYS = (STYLE_COLOR_KEYS + %w[grid_opacity grid_visible]).freeze
  HEX_COLOR = /\A#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\z/

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :space_type, inclusion: { in: SPACE_TYPES }
  validates :cover_type, inclusion: { in: COVER_TYPES }
  validates :width, :depth, numericality: { greater_than_or_equal_to: DIMENSION_MIN, less_than_or_equal_to: DIMENSION_MAX }
  validates :height, numericality: { greater_than_or_equal_to: HEIGHT_MIN, less_than_or_equal_to: HEIGHT_MAX }
  validates :point_scale, numericality: { greater_than_or_equal_to: 0.3, less_than_or_equal_to: 3.0 }
  validates :room_style, inclusion: { in: ROOM_STYLES }
  validate :style_overrides_are_valid

  before_validation :normalize_style_overrides

  scope :recent, -> { order(created_at: :desc) }

  # カバー候補ポイント（生成画像が添付済みのポイントを序数順で）
  def cover_point_candidates
    space_points.select { |p| p.image.attached? }.sort_by { |p| [ p.position, p.created_at ] }
  end

  def cover_point
    cover_space_point&.image&.attached? ? cover_space_point : cover_point_candidates.first
  end

  # first_card（先頭切替）/ collage 用に並べたポイント（cover_space_point を先頭に）
  def cover_points(limit: COVER_CARDS_LIMIT)
    ordered = cover_point_candidates
    if cover_space_point_id && (chosen = ordered.find { |p| p.id == cover_space_point_id })
      ordered = [ chosen, *ordered.reject { |p| p.id == cover_space_point_id } ]
    end
    ordered.first(limit)
  end

  private

  # 空文字・nil の上書きは「未設定」として捨てる（フロントが項目を消したときに残さない）。
  def normalize_style_overrides
    self.style_overrides = {} if style_overrides.blank?
    return unless style_overrides.is_a?(Hash)

    self.style_overrides = style_overrides.reject { |_, v| v.nil? || v.to_s.strip.empty? }
  end

  def style_overrides_are_valid
    unless style_overrides.is_a?(Hash)
      errors.add(:style_overrides, "の形式が不正です")
      return
    end

    unknown = style_overrides.keys.map(&:to_s) - STYLE_OVERRIDE_KEYS
    errors.add(:style_overrides, "に不明な項目があります: #{unknown.join(', ')}") if unknown.any?

    STYLE_COLOR_KEYS.each do |key|
      value = style_overrides[key]
      next if value.nil?

      errors.add(:style_overrides, "の #{key} が色指定ではありません") unless value.to_s.match?(HEX_COLOR)
    end

    opacity = style_overrides["grid_opacity"]
    unless opacity.nil? || (opacity.is_a?(Numeric) && opacity.between?(0, 1))
      errors.add(:style_overrides, "の grid_opacity は 0〜1 で指定してください")
    end

    visible = style_overrides["grid_visible"]
    errors.add(:style_overrides, "の grid_visible は true/false で指定してください") unless visible.nil? || [ true, false ].include?(visible)
  end
end
