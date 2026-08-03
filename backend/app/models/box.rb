class Box < ApplicationRecord
  include CoverGeneratable
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
  # 一覧用に、ページ内の全ボックスのカバー候補を 1 クエリでまとめて取る。
  # 1 件ずつ引くと一覧の件数だけクエリが増えるため、
  # ウィンドウ関数で「ボックスごとの先頭 N 件」だけを抜く。
  def self.preload_cover_entries(boxes, limit: COVER_CARDS_LIMIT + 1)
    return boxes if boxes.empty?

    ranked = BoxEntry.where(box_id: boxes.map(&:id))
                     .select("box_entries.*, ROW_NUMBER() OVER (PARTITION BY box_id ORDER BY created_at) AS rn")
    rows = BoxEntry.from("(#{ranked.to_sql}) AS box_entries")
                   .where("rn <= ?", limit)
                   .includes(:entry)
                   .to_a
    # 中身の画像も先に用意する。ここで揃えないと、カバーを組み立てる段で
    # エントリ 1 件ずつ画像を引くことになり、結局 N+1 になる。
    entries = rows.filter_map(&:entry)
    items = entries.grep(Item)
    views = entries.grep(View)
    preload(items, { medias: { file_attachment: :blob } })
    if views.any?
      View.preload_cover_items(views)
      preload(views.filter_map(&:cover_item), { medias: { file_attachment: :blob } })
    end

    grouped = rows.group_by(&:box_id)
    boxes.each { |b| b.preloaded_cover_entries = grouped[b.id] || [] }
    boxes
  end

  def self.preload(records, associations)
    return if records.empty?

    ActiveRecord::Associations::Preloader.new(records: records, associations: associations).call
  end
  private_class_method :preload

  attr_writer :preloaded_cover_entries

  # カバーに使うのは先頭の数枚だけ。中身の数に比例させない。
  def cover_item_candidates(limit: COVER_CARDS_LIMIT)
    entries = @preloaded_cover_entries || box_entries.order(:created_at).limit(limit)
    entries.first(limit).filter_map do |e|
      case e.entry_type
      when "Item" then e.entry
      when "View" then e.entry&.cover
      end
    end
  end

  def cover
    cover_item || cover_item_candidates(limit: 1).first
  end

  # first_card（先頭切替）/ collage 用に並べたカード（cover_item を先頭に）
  def cover_cards(limit: COVER_CARDS_LIMIT)
    # cover_item を先頭へ寄せる分、1 枚多めに取っておく
    ordered = cover_item_candidates(limit: limit + 1)
    if cover_item_id && (chosen = ordered.find { |i| i.id == cover_item_id })
      ordered = [ chosen, *ordered.reject { |i| i.id == cover_item_id } ]
    end
    ordered.first(limit)
  end
end
