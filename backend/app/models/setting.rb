class Setting < ApplicationRecord
  # カード詳細の列数。3列より多いと1列が細くなりすぎて、
  # 説明のような長い項目が読めなくなる
  CARD_DETAIL_COLUMN_RANGE = (1..3).freeze
  validates :card_detail_columns, inclusion: { in: CARD_DETAIL_COLUMN_RANGE }

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

  # 単語生成の既定の難しさ（アクロポリス・デルフォイの初期値）
  validates :word_difficulty, inclusion: { in: GenerateWordsService::DIFFICULTIES }

  # ライブラリの棚（大項目）。既定の並び順でもある
  LIBRARY_SECTIONS = %w[cards canvas spaces boxes materials].freeze

  # カードが持つ項目のひな型。1つあたり { "name" =>, "keys" => [...] }
  MAX_CARD_PRESETS = 20
  MAX_PRESET_KEYS = 60

  # 宮殿の名前。長いと画面の見出しが折り返す
  MAX_PALACE_NAME_LENGTH = 30

  # 一覧のカードに、名前と絵のほかに出す項目の数。
  # 増やすほど1枚が縦に伸び、一覧として見渡せなくなる。
  # 名前と絵で2つぶん使っているので、追加はここまで
  MAX_CARD_LIST_FIELDS = 2

  belongs_to :user

  validates :user_id, uniqueness: true
  validates :palace_name, length: { maximum: MAX_PALACE_NAME_LENGTH }, allow_blank: true
  validates :diagram_mode, inclusion: { in: DIAGRAM_MODES }
  validates :motion_mode, inclusion: { in: MOTION_MODES }
  # 新規カードのデフォルト画像スタイル。空文字は「おまかせ（指定なし）」を許容する。
  validates :default_image_style, inclusion: { in: PromptBuilderService::STYLES }, allow_blank: true

  # 保存前に並び順を正しておく。
  # 知らない名前は捨て、重複は畳み、載っていない棚は末尾へ回す。
  # こうしておけば、棚が増えても既存ユーザーの画面から消えることがない。
  before_validation :normalize_library_order
  before_validation :normalize_card_property_presets
  before_validation :normalize_card_list_fields

  # 名前でひな型を引く。無ければ nil
  def card_preset(name)
    Array(card_property_presets).find { |preset| preset["name"] == name.to_s }
  end

  # 新しいカードに当てるひな型。指定が無ければ nil
  def default_preset_keys
    return nil if default_card_preset.blank?

    card_preset(default_card_preset)&.dig("keys")
  end

  # 実際に描くべき並び。未設定なら既定の順
  def ordered_library_sections
    self.class.normalize_sections(library_order)
  end

  def self.normalize_sections(order)
    kept = Array(order).map(&:to_s).uniq.select { |key| LIBRARY_SECTIONS.include?(key) }
    kept + (LIBRARY_SECTIONS - kept)
  end

  private

  # 一覧に出す追加項目。上限を超えたぶんは切る
  def normalize_card_list_fields
    self.card_list_fields = Array(card_list_fields).map(&:to_s).reject(&:blank?).uniq.first(MAX_CARD_LIST_FIELDS)
  end

  # 名前とキーだけに絞り、名前の無いもの・重複・多すぎるものを落とす。
  # 画面から来た形をそのまま入れると、あとで読む側が毎回身構えることになる
  def normalize_card_property_presets
    seen = Set.new
    self.card_property_presets = Array(card_property_presets).filter_map { |raw|
      next unless raw.is_a?(Hash)

      name = raw["name"].to_s.strip
      next if name.blank? || !seen.add?(name)

      keys = Array(raw["keys"]).map(&:to_s).uniq.first(MAX_PRESET_KEYS)
      { "name" => name, "keys" => keys }
    }.first(MAX_CARD_PRESETS)
  end

  def normalize_library_order
    # 未設定（既定の順のまま）はそのまま空で持つ。既定の順が変わったときに追従できる
    return if Array(library_order).empty?

    self.library_order = self.class.normalize_sections(library_order)
  end
end
