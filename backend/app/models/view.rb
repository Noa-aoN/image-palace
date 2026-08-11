class View < ApplicationRecord
  include CoverGeneratable
  self.table_name = "views"

  belongs_to :user
  # space_map 種別: 配置先のスペース（作成済みの road/room）
  belongs_to :space, optional: true
  has_many :box_entries, as: :entry, dependent: :destroy
  has_many :view_items, dependent: :destroy
  has_many :items, through: :view_items
  # freeboard: カード間の接続線（フローチャート）
  has_many :view_edges, dependent: :destroy
  # AI 調整を戻すための状態の控え
  has_many :view_revisions, dependent: :destroy
  # カバー（デッキ踏襲）。表紙はキャンバスに配置した Item を指定。
  belongs_to :cover_item, class_name: "Item", optional: true
  has_one_attached :cover_image
  # 一覧用サムネ（480px WebP）。CDN 直配信のためアップロード時に作成する。
  has_one_attached :cover_thumb
  # freeboard: ボードの背景画像（任意）
  has_one_attached :background_image

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

  # 一覧用に、ページ内の全キャンバスのカバー候補を 1 クエリでまとめて取る。
  #
  # 1 件ずつ cover_item_candidates を呼ぶと一覧の件数だけクエリが増える。
  # ウィンドウ関数で「キャンバスごとの先頭 N 件」だけを抜けば、
  # 一覧の件数にも配置カードの件数にも比例しない定数クエリで済む。
  def self.preload_cover_items(views, limit: COVER_CARDS_LIMIT + 1)
    return views if views.empty?

    ranked = ViewItem.where(view_id: views.map(&:id))
                     .select("view_items.*, ROW_NUMBER() OVER (PARTITION BY view_id ORDER BY created_at) AS rn")
    rows = ViewItem.from("(#{ranked.to_sql}) AS view_items")
                   .where("rn <= ?", limit)
                   .includes(item: Item::MEDIA_INCLUDES)
                   .to_a
    grouped = rows.group_by(&:view_id)
    views.each { |v| v.preloaded_cover_items = (grouped[v.id] || []).filter_map(&:item) }
    views
  end

  attr_writer :preloaded_cover_items

  # カバー候補カード（キャンバスに配置したカードを追加順で）
  # カバーに使うのは先頭の数枚だけ。全件を読んで Ruby 側で並べ替えると
  # 配置カードの数に比例して遅くなるため、DB 側で必要数だけ取る。
  def cover_item_candidates(limit: COVER_CARDS_LIMIT)
    return @preloaded_cover_items.first(limit) if @preloaded_cover_items

    view_items
      .includes(item: Item::MEDIA_INCLUDES)
      .order(:created_at)
      .limit(limit)
      .filter_map(&:item)
  end

  def cover
    cover_item || cover_item_candidates(limit: 1).first
  end

  def cover_cards(limit: COVER_CARDS_LIMIT)
    # cover_item を先頭へ寄せる分、1 枚多めに取っておく
    ordered = cover_item_candidates(limit: limit + 1)
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
