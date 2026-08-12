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

  # == 一覧に出す項目（順序つき） ============================================
  #
  # 表示の有無と並び順を**1つの並び**で持つ。分かれていると並び替えができず、
  # 名前と下の項目の関係も決められなかった。
  #
  # 形: [{ "key" => "title", "visible" => true }, ...]
  #
  # key は組み込み（title / image / meaning）か、利用者が作った項目の
  # 識別名（読み方・別名など）。**組み込み以外は "property:" を付けない**
  # （項目の識別名がそのまま入る。既存の card_headline_key と同じ形にして、
  # 移行で読み替えずに済ませる）。
  CARD_LIST_BUILTIN_KEYS = %w[title image meaning].freeze

  # **上限は「出す指定の数」に掛ける。** 候補そのものは持っていてよい。
  # 候補ごと切ってしまうと、選べる項目を増やしたときに
  # 「一度隠した項目が消えていた」という分かりにくい欠け方をする。
  MAX_VISIBLE_CARD_LIST_FIELDS = 5
  # 候補として持てる数。ここは器の上限で、画面の見え方には効かない
  MAX_CARD_LIST_LAYOUT = 30

  # 何も設定していない人の並び。これまでの見え方（名前と絵）と同じにする
  DEFAULT_CARD_LIST_LAYOUT = [
    { "key" => "title", "visible" => true },
    { "key" => "image", "visible" => true }
  ].freeze

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
  before_validation :normalize_card_list_layout
  validate :visible_card_list_fields_within_limit

  # 名前でひな型を引く。無ければ nil
  def card_preset(name)
    Array(card_property_presets).find { |preset| preset["name"] == name.to_s }
  end

  # 新しいカードに当てるひな型。指定が無ければ nil
  def default_preset_keys
    return nil if default_card_preset.blank?

    card_preset(default_card_preset)&.dig("keys")
  end

  # 一覧に出す項目の並び。**ここが真実の場所**。
  #
  # まだ新しい形で保存していない人には、旧の2つ（card_headline_key /
  # card_list_fields）から読み解いて返す。読み解くだけで書き戻さないのは、
  # 設定画面を開いていない人の行をこちらの都合で書き換えないため。
  def card_list_layout_entries
    stored = Array(card_list_layout).select { |row| row.is_a?(Hash) && row["key"].present? }
    rows = stored.any? ? stored : migrated_card_list_layout

    # 古い行が上限を超えていても壊れないようにする。
    # **書き戻さない**（読むだけの人の行を、こちらの都合で変えない）
    shown = 0
    rows.map do |row|
      next row unless row["visible"]

      shown += 1
      shown <= MAX_VISIBLE_CARD_LIST_FIELDS ? row : row.merge("visible" => false)
    end
  end

  # 出す項目だけを順に返す（画面はこれをそのまま並べる）
  def visible_card_list_keys
    card_list_layout_entries.select { |row| row["visible"] }.map { |row| row["key"].to_s }
  end

  # 旧の設定を新しい形に読み替える。
  #   card_headline_key … 名前として出していた項目。先頭に置く
  #   card_list_fields  … 名前の下に出していた項目。絵の後ろに続ける
  # どちらも空なら、これまでどおり「名前と絵」。
  def migrated_card_list_layout
    keys = []
    keys << (card_headline_key.presence || "title")
    keys << "image"
    keys.concat(Array(card_list_fields).map(&:to_s))

    keys.uniq.first(MAX_VISIBLE_CARD_LIST_FIELDS).map { |key| { "key" => key, "visible" => true } }
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

  # 並びを正しておく。知らない形は捨て、重複は畳み、多すぎるぶんは切る。
  # 画面から来た形をそのまま入れると、読む側が毎回身構えることになる
  def normalize_card_list_layout
    seen = Set.new
    self.card_list_layout = Array(card_list_layout).filter_map { |raw|
      next unless raw.is_a?(Hash)

      key = raw["key"].to_s.strip
      next if key.blank? || !seen.add?(key)

      # visible が無い形（key だけの配列）で来ても、出す指定として受ける
      { "key" => key, "visible" => raw.fetch("visible", true) ? true : false }
    }.first(MAX_CARD_LIST_LAYOUT)
  end

  # 出す指定が多すぎるときは、断る。**黙って落とさない**
  # （落とすと、6件目を入れたつもりの人には「入らなかった」ことが伝わらない）
  def visible_card_list_fields_within_limit
    visible = Array(card_list_layout).count { |row| row.is_a?(Hash) && row["visible"] }
    return if visible <= MAX_VISIBLE_CARD_LIST_FIELDS

    errors.add(:card_list_layout, "に出す項目は#{MAX_VISIBLE_CARD_LIST_FIELDS}件までです（いま#{visible}件）")
  end

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
