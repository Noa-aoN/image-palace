class Deck < ApplicationRecord
  belongs_to :user
  belongs_to :cover_item, class_name: "Item", optional: true
  has_many :deck_items, dependent: :destroy
  has_many :items, through: :deck_items
  has_many :collection_decks, dependent: :destroy
  has_many :collection_entries, as: :entry, dependent: :destroy

  # custom カバー用のアップロード/生成画像
  has_one_attached :cover_image

  NAME_MAX_LENGTH = 100
  # カバーの表示モード
  COVER_TYPES = %w[first_card collage custom].freeze
  # カバー描画に渡すカード枚数の上限（先頭切替・コラージュ用）
  COVER_CARDS_LIMIT = 8

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :cover_type, inclusion: { in: COVER_TYPES }

  scope :recent, -> { order(created_at: :desc) }

  # 表紙カード（未指定ならデッキに最初に追加したカードを使う）
  def cover
    cover_item || items.order(Arel.sql("deck_items.created_at ASC")).first
  end

  # カバー描画用に並べたカード（cover_item を先頭に、以降は追加順）。
  # deck_items が preload 済みなら追加クエリを発生させない。
  def cover_cards(limit: COVER_CARDS_LIMIT)
    ordered = deck_items.sort_by(&:created_at).map(&:item)
    if cover_item_id && (cover = ordered.find { |i| i.id == cover_item_id })
      ordered = [ cover, *ordered.reject { |i| i.id == cover_item_id } ]
    end
    ordered.first(limit)
  end
end
