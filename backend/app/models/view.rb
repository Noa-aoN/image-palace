class View < ApplicationRecord
  self.table_name = "views"

  belongs_to :user
  # space_map 種別: 配置先のスペース（作成済みの road/room）
  belongs_to :space, optional: true
  has_many :box_entries, as: :entry, dependent: :destroy
  has_many :view_items, dependent: :destroy
  has_many :items, through: :view_items
  # freeboard: カード間の接続線（フローチャート）
  has_many :view_edges, dependent: :destroy
  # カバー（デッキ踏襲）。表紙はキャンバスに配置した Item を指定。
  belongs_to :cover_item, class_name: "Item", optional: true
  has_one_attached :cover_image
  # 一覧用サムネ（480px WebP）。CDN 直配信のためアップロード時に作成する。
  has_one_attached :cover_thumb

  NAME_MAX_LENGTH = 100
  # freeboard / space_map / deck を実装。他は種別を仮置き（詳細画面は「準備中」表示）。
  # deck はカードの順序付きリスト（view_items.position で並べる）。
  VIEW_TYPES = %w[freeboard space_map deck page map timeline binder album].freeze
  COVER_TYPES = %w[first_card collage custom].freeze
  COVER_CARDS_LIMIT = 8

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :view_type, inclusion: { in: VIEW_TYPES }
  validates :cover_type, inclusion: { in: COVER_TYPES }
  # スペース配置は配置先スペース必須。指定スペースは本人所有であること。
  validates :space_id, presence: true, if: -> { view_type == "space_map" }
  validate :space_must_belong_to_user, if: -> { space_id.present? }

  scope :recent, -> { order(created_at: :desc) }

  def space_map?
    view_type == "space_map"
  end

  def deck?
    view_type == "deck"
  end

  def freeboard?
    view_type == "freeboard"
  end

  # カバー候補カード（キャンバスに配置したカードを追加順で）
  def cover_item_candidates
    view_items.sort_by(&:created_at).filter_map(&:item)
  end

  def cover
    cover_item || cover_item_candidates.first
  end

  def cover_cards(limit: COVER_CARDS_LIMIT)
    ordered = cover_item_candidates
    if cover_item_id && (chosen = ordered.find { |i| i.id == cover_item_id })
      ordered = [ chosen, *ordered.reject { |i| i.id == cover_item_id } ]
    end
    ordered.first(limit)
  end

  private

  def space_must_belong_to_user
    return if user && user.spaces.exists?(id: space_id)

    errors.add(:space, "が見つかりません")
  end
end
