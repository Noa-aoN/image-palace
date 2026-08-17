# frozen_string_literal: true

# 獲得物（称号・勲章・宝物・表彰）の定義。
#
# 4種を1テーブルにしているのは、列の9割が同じで、管理画面・ギャラリー・通知・付与の
# 流れも同じだから。分けると同じ画面を4つ作ることになる。
# 違いは kind と「どこに出せるか」だけ。
#
# 組み込み（BUILTINS）は初回の読み出しで行として取り込む。以後は行が正。
# 消せないのは、コードや他の定義が key を参照しているため（止めたいときは無効にする）。
class RewardDefinition < ApplicationRecord
  KINDS = %w[title medal treasure honor].freeze

  # 並べる順。**名乗る側から、持ち物側へ。**
  #   称号 … 名乗り（1つだけ掲げる）
  #   勲章 … 名乗りに添える証
  #   表彰 … 運営から贈られたもの
  #   宝物 … 部屋に置く品物（重ねて持てる）
  # KINDS とは別に持つ。あちらは「どれが有効な種別か」で、順番の意味は無い
  DISPLAY_ORDER = %w[title medal honor treasure].freeze
  KIND_LABELS = {
    "title" => "称号", "medal" => "勲章", "treasure" => "宝物", "honor" => "表彰"
  }.freeze

  # レア度は9段階。九柱のムーサに対応させてある。
  # ただし**画面では5つに丸めて出す**。9段階をそのまま並べると、
  # 見る側は違いを覚えられず、ただ細かいだけになる。
  RARITY_LEVELS = (1..9).to_a.freeze
  RARITY_NAMES = {
    1 => "石", 2 => "青銅", 3 => "大理石", 4 => "銀", 5 => "金",
    6 => "瑠璃", 7 => "星", 8 => "神聖", 9 => "ムーサ"
  }.freeze

  # 段の目安。**到達の遠さ**に対応させる。
  #
  #   1〜2 … 初日から数日で届く
  #   3〜4 … 数週間
  #   5   … 数ヶ月
  #   6   … 半年〜1年
  #   7   … 年単位
  #   8〜9 … いまは使わない。長く続けた人・特別な表彰のために空けておく
  #
  # 序盤で高い段を配ると、あとから出すものが無くなる。
  # 上を空けておくのは、続けた人に渡すものを残すため。
  RARITY_GUIDE = {
    1 => "初日", 2 => "数日", 3 => "数週間", 4 => "1〜2か月", 5 => "数か月",
    6 => "半年〜1年", 7 => "年単位", 8 => "（未使用）", 9 => "（未使用）"
  }.freeze

  # 画面で使う5つの段。枠の見た目はこちらで決める
  RARITY_TIERS = {
    1 => "stone", 2 => "stone", 3 => "stone",
    4 => "metal", 5 => "metal",
    6 => "jewel", 7 => "jewel",
    8 => "sacred", 9 => "muse"
  }.freeze

  # 差し替えられるようにするため、画像はファイルとして持つ。
  # 無い間は kind ごとの既定の絵柄（画面側）で出す
  has_one_attached :image
  has_many :user_rewards, dependent: :destroy

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z][a-z0-9_]*\z/ }
  validates :kind, inclusion: { in: KINDS }
  validates :rarity_level, inclusion: { in: RARITY_LEVELS }
  validates :name, presence: true
  validate :period_must_be_forward

  before_validation :apply_kind_defaults, on: :create

  scope :ordered, -> { order(:position, :created_at) }
  scope :of_kind, ->(kind) { where(kind: kind) }
  scope :active, -> { where(enabled: true) }

  # 初期の獲得物。判定できる条件だけで組んである
  # （カードの公開機能が無いため、公開系は入れていない）
  BUILTINS = [
    # ── 称号 ──
    { key: "title_traveler", kind: "title", name: "記憶の旅人", rarity_level: 1, category: "学習",
      description: "はじめの一歩を踏み出した人へ。", position: 10,
      metadata: { "motif" => "a traveler's marble stele with a small laurel sprig and a winding road relief" }, image_key: "o18zg7f5u2w1m2gapa2eu4kaxz66" },
    { key: "title_apprentice", kind: "title", name: "見習い学匠", rarity_level: 2, category: "学習",
      description: "繰り返し見返すことを覚えた人へ。", position: 11,
      metadata: { "motif" => "an apprentice scholar's stele with an open wax tablet and stylus relief" }, image_key: "g4lcfsvq5lgomp4keve06askrvbz" },
    { key: "title_collector", kind: "title", name: "知識の蒐集家", rarity_level: 3, category: "創作",
      description: "多くのカードを集めた人へ。", position: 12,
      metadata: { "motif" => "a collector's stele with rows of small amphora relief and a laurel border" }, image_key: "b7mo8qbmozxpb7elpzqt9osoql9k" },
    { key: "title_visual_thinker", kind: "title", name: "視覚思考家", rarity_level: 4, category: "創作",
      description: "絵で考えることを身につけた人へ。", position: 13,
      metadata: { "motif" => "a stele with an eye motif surrounded by geometric constellation lines" }, image_key: "bp2ryglac07hq39s4euu9qj8j2dj" },

    # ── 勲章 ──
    { key: "medal_first_card", kind: "medal", name: "初回作成の徽章", rarity_level: 1, category: "創作",
      description: "はじめてカードを作った証。", position: 20,
      metadata: { "motif" => "an eight-pointed star badge with a single small amphora at the center" }, image_key: "ssqpdgzifoxylf6b5569h4zse5wz" },
    { key: "medal_creation_flame", kind: "medal", name: "創作の火章", rarity_level: 2, category: "創作",
      description: "絵を作り続けた証。", position: 21,
      metadata: { "motif" => "a round medal with a stylized flame in an oil lamp at the center" }, image_key: "vtwfgst6kayf78q26ujxkoa70uae" },
    { key: "medal_streak_star", kind: "medal", name: "7日継続の星章", rarity_level: 3, category: "継続",
      description: "7日続けた証。", position: 22,
      metadata: { "motif" => "a seven-pointed star badge with a laurel ring at the center" }, image_key: "m3th0qst3q3etdhtq9b7epqno1t5" },
    { key: "medal_laurel", kind: "medal", name: "蒐集の月桂冠", rarity_level: 5, category: "創作",
      description: "100枚のカードを積み上げた証。", position: 23,
      metadata: { "motif" => "a full laurel wreath crown shaped as a circular medal" }, image_key: "xni91sd8u68mlyc4aju1p1lkh3pm" },

    # ── 宝物 ──
    { key: "treasure_seed", kind: "treasure", name: "記憶の種", rarity_level: 1, category: "学習",
      description: "すべてはここから。", position: 30,
      metadata: { "motif" => "a small clay pot holding a single sprouting seed" }, image_key: "ur6et8kagnnjhzr66l6av0oplwe3" },
    { key: "treasure_tablet", kind: "treasure", name: "小さな石板", rarity_level: 2, category: "学習",
      description: "積み重ねた学習の記録。", position: 31,
      metadata: { "motif" => "a small stone tablet with faint carved grid lines" }, image_key: "4htwy3acujtos3t2zw3mi72r7wyu" },
    { key: "treasure_cup", kind: "treasure", name: "青銅の小杯", rarity_level: 2, category: "創作",
      description: "10枚のカードを作った宝物。", position: 32,
      metadata: { "motif" => "a small two-handled bronze drinking cup (kylix)" }, image_key: "ytajhw0ret812b87m0gzrdd19wq9" },
    { key: "treasure_book", kind: "treasure", name: "学匠の書籍", rarity_level: 3, category: "学習",
      description: "正しく答え続けた宝物。", position: 33,
      metadata: { "motif" => "a bound codex with a leather strap and a laurel emblem" }, image_key: "idln7pibyinzknsuu51or5rc2bhw" },
    { key: "treasure_laurel_pot", kind: "treasure", name: "月桂樹の鉢植え", rarity_level: 4, category: "継続",
      description: "長く続けた人の部屋に。", position: 34,
      metadata: { "motif" => "a terracotta pot with a young laurel tree" }, image_key: "n1vzsrdej830hkyb3nut6cnx0us3" },
    { key: "treasure_shelf", kind: "treasure", name: "小さな本棚", rarity_level: 3, category: "整理",
      description: "まとめる力の宝物。", position: 35,
      metadata: { "motif" => "a small wooden shelf holding rolled scrolls" }, image_key: "73afip2yv4lsxx2ckjiopxybk5b4" },


    # ── ここから追加分（絵はまだ用意していない。種類ごとの絵柄で出る） ──
    # 称号
    { key: "title_scribe", kind: "title", name: "宮殿の書記官", rarity_level: 3, category: "整理",
      description: "まとめる術を身につけた人へ。", position: 14,
      metadata: { "motif" => "a stele with crossed reed pens over a scroll" }, image_key: "ua8zuzhz31atgfiagnxkf2390wxe" },
    { key: "title_mnemonist", kind: "title", name: "記憶術士", rarity_level: 5, category: "学習",
      description: "覚える技を修めた人へ。", position: 15,
      metadata: { "motif" => "a stele with a labyrinth pattern and a small key" }, image_key: "iljssdhxlg4cs8jun3tegms7cbqp" },
    { key: "title_keeper", kind: "title", name: "書庫の守り手", rarity_level: 6, category: "継続",
      description: "長く宮殿を守り続けた人へ。", position: 16,
      metadata: { "motif" => "a stele with a temple door flanked by two torches" }, image_key: "vqc6zy33rxewfc9n06mgkhnwm8sk" },

    # 勲章
    { key: "medal_first_shelf", kind: "medal", name: "整理の徽章", rarity_level: 1, category: "整理",
      description: "はじめてまとめた証。", position: 24,
      metadata: { "motif" => "a small round badge with a stack of tablets" }, image_key: "s6caz2oq2wis0w2m7m29q7sc7sj8" },
    { key: "medal_quiz", kind: "medal", name: "問答の星章", rarity_level: 3, category: "学習",
      description: "問いに答え続けた証。", position: 25,
      metadata: { "motif" => "a six-pointed star badge with a question-and-answer scroll" }, image_key: "6lmgbzvtiyypqqbj8u3oi0b1g1ww" },
    { key: "medal_month", kind: "medal", name: "月の徽章", rarity_level: 4, category: "継続",
      description: "ひと月続けた証。", position: 26,
      metadata: { "motif" => "a crescent moon badge with a laurel sprig" }, image_key: "a1654caaqz0aywwxe79m09wn8byg" },
    { key: "medal_year", kind: "medal", name: "年輪の勲章", rarity_level: 7, category: "継続",
      description: "一年ぶん通った証。", position: 27,
      metadata: { "motif" => "a medal with concentric tree rings and a laurel border" }, image_key: "680s8csh5831op23c5iycbrsm65j" },

    # 宝物
    { key: "treasure_lyre", kind: "treasure", name: "小さな竪琴", rarity_level: 3, category: "創作",
      description: "調べを奏でる道具。", position: 36,
      metadata: { "motif" => "a small lyre with strings" }, image_key: "pinjty30v59fwfb0qfud2f5dwkqg" },
    { key: "treasure_scroll", kind: "treasure", name: "束ねた巻物", rarity_level: 2, category: "整理",
      description: "しまっておいた言葉たち。", position: 37,
      metadata: { "motif" => "a bundle of rolled scrolls tied with a cord" }, image_key: "reu28tlzqcqp9m5yee4pw6n1lxlq" },
    { key: "treasure_key", kind: "treasure", name: "青銅の鍵", rarity_level: 4, category: "学習",
      description: "開けた扉のしるし。", position: 38,
      metadata: { "motif" => "an ornate bronze key with a laurel bow" }, image_key: "7rvcryvecrrlm1cqu8nkzff5q8df" },
    { key: "treasure_lamp", kind: "treasure", name: "燭台", rarity_level: 3, category: "継続",
      description: "夜も灯し続けた明かり。", position: 39,
      metadata: { "motif" => "a three-branch oil lamp stand with small flames" }, image_key: "iuac7l5iqsorl7juhvr2udultwb4" },
    { key: "treasure_star_map", kind: "treasure", name: "星図", rarity_level: 5, category: "学習",
      description: "知の並びを写した図。", position: 40,
      metadata: { "motif" => "a circular star chart engraved on a metal disc" }, image_key: "66icq1u7065w743reffkkwwxzt2y" },
    { key: "treasure_statuette", kind: "treasure", name: "小さな女神像", rarity_level: 6, category: "創作",
      description: "宮殿を見守るもの。", position: 41,
      metadata: { "motif" => "a small standing goddess figurine on a plinth" }, image_key: "ct0d17sexbby4gt24tslqgoutu3a" },
    { key: "treasure_trophy", kind: "treasure", name: "月桂のトロフィー", rarity_level: 7, category: "創作",
      description: "特別な達成のしるし。", position: 42,
      metadata: { "motif" => "a two-handled trophy cup crowned with a laurel wreath" }, image_key: "zxzfakbelxuxc7fm6aub2h6gpdg3" },


    # ── 称号（追加分。名乗りは12まで用意する） ──
    { key: "title_illustrator", kind: "title", name: "幻視の絵師", rarity_level: 2, category: "創作",
      description: "言葉を絵に変え続けた人へ。", position: 17,
      metadata: { "motif" => "a stele with a painter's palette and a stylus over a laurel sprig" }, image_key: "6gzvjj5xx82begri5jx2pf6z9g7k" },
    { key: "title_curator", kind: "title", name: "展示の主", rarity_level: 4, category: "整理",
      description: "並べて見せる術を持つ人へ。", position: 18,
      metadata: { "motif" => "a stele with a colonnade and small framed tablets between the columns" }, image_key: "b3h0vwwbxwr16pn5uco788uef0y3" },
    { key: "title_disciplined", kind: "title", name: "不断の徒", rarity_level: 5, category: "継続",
      description: "途切れさせなかった人へ。", position: 19,
      metadata: { "motif" => "a stele with an endless meander (Greek key) border and a small hourglass" }, image_key: "2crgkzu18i7v09z5i1tb511kq2dc" },
    { key: "title_architect", kind: "title", name: "宮殿の設計者", rarity_level: 6, category: "整理",
      description: "自分の宮殿を組み上げた人へ。", position: 20,
      metadata: { "motif" => "a stele with a temple floor plan and a pair of dividers" }, image_key: "h1lpv59wy197ktapr0pypcw47yzk" },
    { key: "title_sage", kind: "title", name: "記憶の賢者", rarity_level: 7, category: "学習",
      description: "思い出す力を極めた人へ。", position: 21,
      metadata: { "motif" => "a stele with an owl above an open scroll and a laurel crown" }, image_key: "hihwwrfi99oyeab2v4jow50jecy3" },

    # ── 勲章（追加分。12まで用意する） ──
    { key: "medal_first_review", kind: "medal", name: "初見返しの徽章", rarity_level: 1, category: "学習",
      description: "はじめて見返した証。", position: 28,
      metadata: { "motif" => "a small round badge with a single eye over an open tablet" }, image_key: "uktgijj8v07pa4uf36fyq2qi3qqo" },
    { key: "medal_reviews_hundred", kind: "medal", name: "反復の徽章", rarity_level: 4, category: "学習",
      description: "100回見返した証。", position: 29,
      metadata: { "motif" => "a round medal with three concentric rings and a small stylus" }, image_key: "klt966nbwkzrlfp8c45xzr4v71uf" },
    { key: "medal_space", kind: "medal", name: "記憶の宮殿章", rarity_level: 4, category: "整理",
      description: "覚えるための場所を築いた証。", position: 30,
      metadata: { "motif" => "a badge shaped as a small temple facade with four columns" }, image_key: "syqtyfsffqpr70j6fci2gsv6vqtp" },
    { key: "medal_two_hundred", kind: "medal", name: "二百枚の勲章", rarity_level: 5, category: "創作",
      description: "200枚のカードを積み上げた証。", position: 31,
      metadata: { "motif" => "a medal with a stack of tablets encircled by a laurel ring" }, image_key: "u7lv0ijtezd4buantp4yj0hw8icz" },

    # ── 宝物（追加分。18まで用意する） ──
    { key: "treasure_amphora", kind: "treasure", name: "彩色のアンフォラ", rarity_level: 2, category: "創作",
      description: "絵を蓄えた壺。", position: 43,
      metadata: { "motif" => "a black-figure painted amphora with two handles" }, image_key: "03nhcypkvbkzdqoyp34tafosa4h5" },
    { key: "treasure_hourglass", kind: "treasure", name: "砂時計", rarity_level: 3, category: "継続",
      description: "途切れなかった日々のしるし。", position: 44,
      metadata: { "motif" => "a small bronze-framed hourglass with fine sand" }, image_key: "pemar496nsw19dzszt399e89f6b1" },
    { key: "treasure_mask", kind: "treasure", name: "劇の仮面", rarity_level: 4, category: "創作",
      description: "見せる力の宝物。", position: 45,
      metadata: { "motif" => "a classical Greek theatre mask" }, image_key: "kvm6t27h9n1iauroomr9zih6c0ba" },
    { key: "treasure_compass", kind: "treasure", name: "羅針の環", rarity_level: 5, category: "整理",
      description: "迷わず辿り着くための道具。", position: 46,
      metadata: { "motif" => "an engraved bronze ring dial with a pointer" }, image_key: "ro4dc0ljxsbcsdsoj9zcf0u7lqcf" },
    { key: "treasure_owl", kind: "treasure", name: "知恵のふくろう", rarity_level: 6, category: "学習",
      description: "思い出す力を見守るもの。", position: 47,
      metadata: { "motif" => "a small owl figurine perched on a stack of scrolls" }, image_key: "5pplv6i9nlz9ao5m07i70i8z0jz7" },

    # ── 表彰（手動付与のみ。条件では配らない） ──
    { key: "honor_beta", kind: "honor", name: "β参加者", rarity_level: 6, category: "公式",
      description: "初期からこの場所を見てくれた人へ。", position: 40,
      metadata: { "grant_note" => "β期間に参加していた人へ、運営がまとめて贈ります。申し込みはありません。",
                  "motif" => "an award plaque with an olive branch and a small owl" }, image_key: "10izs68me4efp3u34nnxs4sgse1n" },
    { key: "honor_supporter", kind: "honor", name: "初期支援者", rarity_level: 7, category: "公式",
      description: "早くから支えてくれた人へ。", position: 41,
      metadata: { "grant_note" => "早い時期に有料プランで支えてくれた人へ、運営が贈ります。申し込みはありません。",
                  "motif" => "an award plaque with a torch and a laurel wreath" }, image_key: "iuo8g39z6sh1e2l7c52c9fsk2n1m" },
    { key: "honor_featured", kind: "honor", name: "公式推薦", rarity_level: 7, category: "公式",
      description: "運営が選んだ作り手へ。", position: 42,
      metadata: { "grant_note" => "運営が選んだ作り手へ贈ります。応募や申請はありません。",
                  "motif" => "an award plaque with a sunburst and a laurel wreath" }, image_key: "cmvez4cmbf1xkb6kajm7cfzni332" },
    # α の期間に居た人へ。β より前なので、段はひとつ上に置く
    { key: "honor_alpha", kind: "honor", name: "α参加者", rarity_level: 8, category: "公式",
      description: "誰よりも早く、この場所を歩いてくれた人へ。", position: 43,
      metadata: { "grant_note" => "α期間（本リリース前）に参加していた人へ、運営がまとめて贈ります。申し込みはありません。",
                  "motif" => "an award plaque with a rising sun over a laurel wreath and a small alpha-shaped ornament" }, image_key: "47b1767x9isvd3dlqvzavql3o2p3" },
    # **運営だけに見える**。持っていない人の一覧に出すと、
    # 取れないものが並ぶことになる（条件を満たしようがない）
    { key: "honor_archon", kind: "honor", name: "執政官", rarity_level: 9, category: "公式",
      description: "この宮殿を運び、守る者へ。", position: 44, admin_only: true,
      metadata: { "grant_note" => "この場所を運んでいる人に付きます。",
                  "motif" => "an official award plaque with a ceremonial staff crossed with a key, framed by a laurel wreath" }, image_key: "85ncj499ri2xr85sx8cs6rbqbuvc" },

    # ── 位（プランに付く称号） ──
    #
    # **稼いで取るものではなく、契約している間だけ持つもの。**
    # 実績で配らないので、条件（condition）は出ない。代わりに description で
    # 「何をすれば持てるか」を言い切る。
    #
    # 無料も含めて5つとも定義を置く。無料だけ位が無いと、
    # 名乗りの棚が「有料の人だけ埋まる場所」に見えてしまう。
    #
    # metadata の source / tier が、同期の目印。**この2つで引く**
    # （鍵の綴りに頼ると、鍵を変えた瞬間に剥奪が効かなくなる）。
    # 位は先頭に並べる（自分がどこに居るかが、いちばん上で分かるように）
    { key: "title_rank_free", kind: "title", name: "市民", rarity_level: 1, category: "公式",
      description: "この宮殿に住まうすべての人へ。", position: 1,
      metadata: { "source" => "subscription", "tier" => "free",
                  "motif" => "a plain marble stele with a simple laurel sprig" },
      image_key: "i0clqasd2bjji0cx6bwe35sehjrm" },
    { key: "title_rank_standard", kind: "title", name: "書記官", rarity_level: 3, category: "公式",
      description: "スタンダードプランを結んでいる間、名乗れる位。", position: 2,
      metadata: { "source" => "subscription", "tier" => "standard",
                  "motif" => "a marble stele with a stylus and an open wax tablet" },
      image_key: "o38x3b5luwllo23y5cxusvu90a5r" },
    { key: "title_rank_pro", kind: "title", name: "学匠", rarity_level: 5, category: "公式",
      description: "プロプランを結んでいる間、名乗れる位。", position: 3,
      metadata: { "source" => "subscription", "tier" => "pro",
                  "motif" => "a marble stele with an open scroll and a laurel border" },
      image_key: "do8cv90a3pph8c6zq2rkez0jts5c" },
    { key: "title_rank_creator", kind: "title", name: "賢者", rarity_level: 7, category: "公式",
      description: "クリエイタープランを結んでいる間、名乗れる位。", position: 4,
      metadata: { "source" => "subscription", "tier" => "creator",
                  "motif" => "a marble stele with an owl above a laurel crown" },
      image_key: "u236ur66xf9q4tzxz2xh1d7llhbo" },
    { key: "title_rank_studio", kind: "title", name: "元老", rarity_level: 9, category: "公式",
      description: "スタジオプランを結んでいる間、名乗れる位。", position: 5,
      metadata: { "source" => "subscription", "tier" => "studio",
                  "motif" => "a marble stele with a ceremonial staff and a full laurel wreath" },
      image_key: "x152ca427d3j3vufkftrsurjwfmn" },

    # ── 遠い到達点の埋め合わせ ──
    #
    # ここまで、いくつかの到達点には**品物が無く、代わりにクレジットを配っていた**。
    # だが到達条件のほとんど（見返す・続ける・集める）はクレジットを使わずに満たせる。
    # 使わずに届く場所からクレジットが出ていくと、人数が増えたぶんだけ持ち出しになる。
    #
    # 品物なら何人に配っても原価は増えない。空いていた場所をここで埋める。
    # 絵はまだ無いので、種別ごとの既定の絵柄で出る（あとから管理画面で差し替えられる）。
    { key: "title_archivist", kind: "title", name: "大蒐集家", rarity_level: 6, category: "創作",
      description: "500枚のカードを集めた人へ。", position: 22,
      metadata: { "motif" => "a stele with tall shelves of amphorae and a laurel crown above" },
      image_key: "13wzvsfmjuoxtmidrfvs243q98vp" },
    { key: "medal_century_streak", kind: "medal", name: "百日連続の勲章", rarity_level: 6, category: "継続",
      description: "100日続けて通った証。", position: 32,
      metadata: { "motif" => "a medal with one hundred small rays around a laurel ring" },
      image_key: "5ym8h3wlmaghsjslkcmp1unika6c" },
    { key: "medal_collector", kind: "medal", name: "蒐集の徽章", rarity_level: 3, category: "創作",
      description: "獲得物を10個集めた証。", position: 33,
      metadata: { "motif" => "a badge showing three small display shelves with tiny objects" },
      image_key: "wbnwmc9ntu0rei9yephfiivci8cp" },
    { key: "treasure_laurel_crown", kind: "treasure", name: "月桂の冠", rarity_level: 7, category: "継続",
      description: "一年ぶん通った人の部屋に。", position: 48,
      metadata: { "motif" => "a woven laurel crown resting on a marble stand" },
      image_key: "wok4118j6wujjedqdlqe8amsdmen" }
  ].freeze

  # 位（プランに付く称号）の目印。同期はこの2つで引く
  SUBSCRIPTION_SOURCE = "subscription"

  # いまの段に対応する位。無ければ nil（その段に位を置いていない）
  def self.rank_for_tier(tier)
    registry.find { |d|
      d.kind == "title" && d.metadata.is_a?(Hash) &&
        d.metadata["source"] == SUBSCRIPTION_SOURCE && d.metadata["tier"] == tier.to_s
    }
  end

  # プランに付く位か。**稼いで取るものではない**ので、
  # 画面では「どうすれば取れるか」ではなく「どのプランに付くか」を出す
  def plan_rank?
    kind == "title" && metadata.is_a?(Hash) && metadata["source"] == SUBSCRIPTION_SOURCE
  end

  # 実績で配らないものの「どうすれば手に入るか」。
  #
  #   位   … どのプランに付くか（説明文がそのまま条件になっている）
  #   表彰 … 誰に・どう配られるか
  #
  # 無ければ nil。画面側が「運営から贈られます」に落とす
  def grant_condition
    return description if plan_rank?

    metadata.is_a?(Hash) ? metadata["grant_note"].presence : nil
  end

  # 位すべて。剥奪のときは、いまの段以外を落とす
  def self.subscription_ranks
    registry.select { |d|
      d.kind == "title" && d.metadata.is_a?(Hash) && d.metadata["source"] == SUBSCRIPTION_SOURCE
    }
  end

  BUILTIN_KEYS = BUILTINS.map { |b| b[:key] }.freeze

  def self.registry
    ensure_builtins!
    ordered.to_a
  end

  # 足りない組み込みだけ入れる。既にある行は触らない（運営が変えた値を戻さない）。
  # ただし画像の鍵だけは、空なら埋める。環境ごとに絵を作り直さずに済ませるため
  def self.ensure_builtins!
    return if @builtins_checked && !Rails.env.local?

    existing = where(key: BUILTIN_KEYS).index_by(&:key)
    BUILTINS.each do |attrs|
      row = existing[attrs[:key]]
      if row.nil?
        create!(attrs)
      else
        row.update_columns(image_key: attrs[:image_key]) if row.image_key.blank? && attrs[:image_key].present?
        fill_missing_metadata!(row, attrs[:metadata])
      end
    rescue ActiveRecord::RecordNotUnique
      nil
    end
    @builtins_checked = true
  end

  # 組み込みに後から足した metadata を、既にある行にも入れる。
  #
  # **足りない鍵だけ**を入れる（運営が書き換えた値は戻さない）。
  # ここが無いと、新しく足した説明は**まだ配っていない環境にしか出ない**。
  # 既に動いている場所では行が先に在るので、いつまでも古いままになる
  def self.fill_missing_metadata!(row, defaults)
    return if defaults.blank?

    current = row.metadata.is_a?(Hash) ? row.metadata : {}
    missing = defaults.reject { |key, _| current.key?(key) }
    return if missing.empty?

    row.update_columns(metadata: current.merge(missing))
  end

  # 表示に使う絵の置き場。
  # 添付（管理画面から上げたもの）が最優先。無ければ鍵から組み立てる
  def image_path
    return image.blob.key if image.attached?

    image_key.presence
  end

  def builtin?
    BUILTIN_KEYS.include?(key)
  end

  # 同じものを複数持てるか。
  #
  # **種別で決める。** 定義ごとの旗は持たない（同じ判断を2か所に置くと必ず食い違う）。
  #   称号 … 名乗るもの。1つ選んで名乗るので、2つ持っても意味が無い
  #   勲章 … 掲げるもの。功績のしるしなので、同じものは1つ
  #   表彰 … 運営が選んで贈るもの。同じ表彰を2回は贈らない
  #   宝物 … 手に入れた品。同じ品が複数あってよい
  def stackable?
    kind == "treasure"
  end

  def kind_label
    KIND_LABELS[kind]
  end

  def rarity_name
    RARITY_NAMES[rarity_level]
  end

  # 枠の見た目に使う段。画面はこれだけを見る
  def rarity_tier
    RARITY_TIERS[rarity_level] || "stone"
  end

  # いま配ってよいか（止めていない・期間内）
  def grantable?(now = Time.current)
    return false unless enabled?
    return true unless limited?

    (starts_at.nil? || starts_at <= now) && (ends_at.nil? || ends_at > now)
  end

  private

  # どこに出せるかは種類でほぼ決まる。作るたびに選ばせるより、
  # 既定を入れておいて、変えたい人だけ変えるほうがよい
  def apply_kind_defaults
    self.equippable = kind == "title" if equippable.nil? || !equippable
    self.featurable = kind == "medal" if featurable.nil? || !featurable
    self.room_displayable = %w[treasure honor].include?(kind) if room_displayable.nil? || !room_displayable
  end

  def period_must_be_forward
    return if starts_at.blank? || ends_at.blank? || starts_at < ends_at

    errors.add(:ends_at, "は開始より後にしてください")
  end
end
