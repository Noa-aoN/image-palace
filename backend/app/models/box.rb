class Box < ApplicationRecord
  belongs_to :user
  # コレクションはカード/スペース/キャンバスをまとめる汎用コンテナ（ポリモーフィック）
  has_many :box_entries, dependent: :destroy
  has_many :box_items, dependent: :destroy
  has_many :space_boxes, dependent: :destroy
  # カバー（デッキ踏襲）。表紙はコレクション内の Item を指定。
  belongs_to :cover_item, class_name: "Item", optional: true
  has_one_attached :cover_image
  # 一覧用サムネ（480px WebP）。CDN 直配信のためアップロード時に作成する。
  has_one_attached :cover_thumb

  NAME_MAX_LENGTH = 100
  COVER_TYPES = %w[first_card collage custom].freeze
  COVER_CARDS_LIMIT = 8

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :cover_type, inclusion: { in: COVER_TYPES }

  scope :recent, -> { order(created_at: :desc) }

  # 自動カバー候補となるカード（画像）を追加順で集める。
  # Item エントリはそのカード、View エントリ（デッキ含む）はその表紙カードを使う
  # （コレクションがキャンバス等だけでもカバーに中身の画像が反映されるようにする）。
  def cover_item_candidates
    box_entries.sort_by(&:created_at).filter_map do |e|
      case e.entry_type
      when "Item" then e.entry
      when "View" then e.entry&.cover
      end
    end
  end

  def cover
    cover_item || cover_item_candidates.first
  end

  # first_card（先頭切替）/ collage 用に並べたカード（cover_item を先頭に）
  def cover_cards(limit: COVER_CARDS_LIMIT)
    ordered = cover_item_candidates
    if cover_item_id && (chosen = ordered.find { |i| i.id == cover_item_id })
      ordered = [ chosen, *ordered.reject { |i| i.id == cover_item_id } ]
    end
    ordered.first(limit)
  end
end
