class Space < ApplicationRecord
  belongs_to :user
  has_many :space_collections, dependent: :destroy
  has_many :collections, through: :space_collections
  has_many :space_points, dependent: :destroy
  has_many :collection_entries, as: :entry, dependent: :destroy
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

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :space_type, inclusion: { in: SPACE_TYPES }
  validates :cover_type, inclusion: { in: COVER_TYPES }

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
end
