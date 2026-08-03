class Setting < ApplicationRecord
  # 一覧の見せ方（simple / palace）
  DISPLAY_STYLES = %w[simple palace].freeze
  validates :display_style, inclusion: { in: DISPLAY_STYLES }

  # 棚の並べ方（宮殿スタイルのときのみ効く）
  SHELF_ORIENTATIONS = %w[rows columns].freeze
  validates :shelf_orientation, inclusion: { in: SHELF_ORIENTATIONS }

  # 新規カードの既定の縦横比（カード側で個別に上書きできる）
  validates :default_aspect_ratio, inclusion: { in: AspectRatios::KEYS }
  # 図（間取り図・記憶資産など）の表現。
  DIAGRAM_MODES = %w[2d 3d].freeze
  # アニメーションの扱い。auto は端末（OS）の prefers-reduced-motion に従う。
  MOTION_MODES = %w[auto on off].freeze

  # ライブラリの棚（大項目）。既定の並び順でもある
  LIBRARY_SECTIONS = %w[cards canvas spaces boxes materials].freeze

  belongs_to :user

  validates :user_id, uniqueness: true
  validates :diagram_mode, inclusion: { in: DIAGRAM_MODES }
  validates :motion_mode, inclusion: { in: MOTION_MODES }
  # 新規カードのデフォルト画像スタイル。空文字は「おまかせ（指定なし）」を許容する。
  validates :default_image_style, inclusion: { in: PromptBuilderService::STYLES }, allow_blank: true

  # 保存前に並び順を正しておく。
  # 知らない名前は捨て、重複は畳み、載っていない棚は末尾へ回す。
  # こうしておけば、棚が増えても既存ユーザーの画面から消えることがない。
  before_validation :normalize_library_order

  # 実際に描くべき並び。未設定なら既定の順
  def ordered_library_sections
    self.class.normalize_sections(library_order)
  end

  def self.normalize_sections(order)
    kept = Array(order).map(&:to_s).uniq.select { |key| LIBRARY_SECTIONS.include?(key) }
    kept + (LIBRARY_SECTIONS - kept)
  end

  private

  def normalize_library_order
    # 未設定（既定の順のまま）はそのまま空で持つ。既定の順が変わったときに追従できる
    return if Array(library_order).empty?

    self.library_order = self.class.normalize_sections(library_order)
  end
end
