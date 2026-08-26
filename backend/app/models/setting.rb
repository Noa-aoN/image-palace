class Setting < ApplicationRecord
  # カード詳細の列数。3列より多いと1列が細くなりすぎて、
  # 説明のような長い項目が読めなくなる
  CARD_DETAIL_COLUMN_RANGE = (1..3).freeze
  validates :card_detail_columns, inclusion: { in: CARD_DETAIL_COLUMN_RANGE }

  # 一覧の見せ方（simple / palace）
  DISPLAY_STYLES = %w[simple palace].freeze
  validates :display_style, inclusion: { in: DISPLAY_STYLES }

  # 覆いの濃さ。**掛けるかどうか（image_safeguard）とは別の軸。**
  #
  # 境目（細部が読めない／構図は掴める）は人によって違う。
  # 不意打ちを避けたいだけの人には薄いほうがよく、
  # 人前で開く人には色の気配すら残さないほうがよい。
  # `normal` が従来の見え方なので、既存の利用者の見え方は変わらない。
  IMAGE_SAFEGUARD_STRENGTHS = %w[light normal strong].freeze
  validates :image_safeguard_strength, inclusion: { in: IMAGE_SAFEGUARD_STRENGTHS }

  # 覆いの濃さの目盛り。**段ではなく連続で持つ。**
  #
  # 「細部は読めない／構図は掴める」の境目は、絵の中身と、見る人と、
  # その場（人前かどうか）で変わる。3つに丸めると、ちょうどよい所が段の間に落ちる。
  #
  # 0 が最も薄く、100 が最も濃い。既定の 50 は、これまでの「標準」と同じ見え方。
  # 上の `image_safeguard_strength` はもう読まない（消すのは別のデプロイで）。
  IMAGE_SAFEGUARD_LEVELS = (0..100).freeze
  validates :image_safeguard_level, inclusion: { in: IMAGE_SAFEGUARD_LEVELS }

  # 棚の並べ方（宮殿スタイルのときのみ効く）
  SHELF_ORIENTATIONS = %w[rows columns].freeze
  validates :shelf_orientation, inclusion: { in: SHELF_ORIENTATIONS }

  # 新規カードの既定の縦横比（カード側で個別に上書きできる）
  validates :default_aspect_ratio, inclusion: { in: AspectRatios::KEYS }
  # 図（間取り図・記憶資産など）の表現。
  DIAGRAM_MODES = %w[2d 3d].freeze
  # アニメーションの扱い。auto は端末（OS）の prefers-reduced-motion に従う。
  MOTION_MODES = %w[auto on off].freeze

  # 単語生成の既定の難しさ（デルフォイ・デルフォイの初期値）
  validates :word_difficulty, inclusion: { in: GenerateWordsService::DIFFICULTIES }

  # ライブラリの棚（大項目）。既定の並び順でもある
  LIBRARY_SECTIONS = %w[cards canvas spaces boxes materials].freeze

  # カードが持つ項目のひな型。1つあたり { "name" =>, "keys" => [...] }
  MAX_CARD_PRESETS = 20
  MAX_PRESET_KEYS = 60

  # 宮殿の名前。長いと画面の見出しが折り返す
  MAX_PALACE_NAME_LENGTH = 30

  # == 一覧に出す項目（順序つき） ============================================
  #
  # 表示の有無と並び順を**1つの並び**で持つ。分かれていると並び替えができず、
  # 名前と下の項目の関係も決められなかった。
  #
  # 形: [{ "key" => "title", "visible" => true }, ...]
  #
  # key は組み込み（title / image / meaning）か、利用者が作った項目の
  # 識別名（読み方・別名など）。**組み込み以外は接頭辞を付けない**
  # （項目の識別名がそのまま入る）。
  CARD_LIST_BUILTIN_KEYS = %w[title image meaning].freeze

  # **上限は「出す指定の数」に掛ける。** 候補そのものは持っていてよい。
  # 候補ごと切ってしまうと、選べる項目を増やしたときに
  # 「一度隠した項目が消えていた」という分かりにくい欠け方をする。
  MAX_VISIBLE_CARD_LIST_FIELDS = 5
  # 候補として持てる数。ここは器の上限で、画面の見え方には効かない
  MAX_CARD_LIST_LAYOUT = 30

  # 何も設定していない人の並び。**ここが既定の出どころ**。
  #
  # 「旧フィールドが空だから、たまたま名前と絵になっていた」のではなく、
  # 新しい設定体系として明示的にこう決める。
  # 何も決めていない人の既定。
  #
  # **意味・説明まで出す。** 見出し語と絵だけだと、絵を見て思い出せなかったときに
  # 一覧の上では確かめようがなく、1枚ずつ開くことになる。
  # 3つとも組み込みの項目なので、利用者が項目を作っていなくても必ず出る
  DEFAULT_CARD_LIST_LAYOUT = [
    { "key" => "title", "visible" => true },
    # 種別の印。**見出し語の右**に出るので、下へ積む項目とは数え方が違う
    { "key" => "item_type", "visible" => true },
    { "key" => "image", "visible" => true },
    { "key" => "meaning", "visible" => true }
  ].freeze

  # 置き場所が決まっている項目。並べ替えの対象にせず、出せる数にも数えない
  FIXED_POSITION_LAYOUT_KEYS = %w[item_type].freeze

  # 見出しとして使わない項目。絵は見出しにならないし、
  # 意味・説明は長すぎて名前にならない。
  # 種別の印は**見出し語の右に添えるもの**なので、それ自体が名前にはならない
  NON_HEADLINE_KEYS = (%w[image meaning] + FIXED_POSITION_LAYOUT_KEYS).freeze

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

  # 一覧に出す項目の並び。**ここが唯一の出どころ**。
  #
  # 保存していない人には既定（名前と絵）を返す。
  def card_list_layout_entries
    stored = Array(card_list_layout).select { |row| row.is_a?(Hash) && row["key"].present? }
    rows = stored.any? ? stored : DEFAULT_CARD_LIST_LAYOUT

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

  # 一覧で名前として出す項目。
  #
  # **並びの先頭にある、名前になりうる項目**（絵と意味・説明は除く）。
  # 別に持たせない（別に持つと、並べ替えたのに名前が変わらない、が起きる）。
  #
  # 何も選んでいなければ nil。呼び出し側が見出し語（items.title）を使う
  def headline_key
    key = visible_card_list_keys.find { |k| NON_HEADLINE_KEYS.exclude?(k) }
    return nil if key.nil? || key == "title"

    key
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
