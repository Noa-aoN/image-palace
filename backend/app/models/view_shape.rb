# frozen_string_literal: true

# ボードに置く図形。
#
# ## 5種類に絞った理由
#
# 図を描く道具（Figma / Miro / FigJam など）が共通して持っているものだけにした。
# 種類を増やすと、選ぶ手間が増えるわりに、できる図はほとんど変わらない。
#
#   junction  … 接合点。**線が分かれる場所**（両親から子へ、など）
#   rectangle … 四角。囲む・区切る
#   ellipse   … 丸。強調する・始点と終点を表す
#   sticky    … 付箋。思いつきを置く（塗りがあり、文字が主役）
#   text      … 文字だけ。見出し・注釈（枠も塗りも無い）
#   frame     … かこみ。**カードの後ろに敷いて群れを囲う**
#
# frame だけは扱いが違う。**いちばん後ろに置き、掴んでも中のカードを動かさない。**
# 前に出ると中身が隠れ、掴めるとカードごと動いてしまう。
class ViewShape < ApplicationRecord
  KINDS = %w[rectangle ellipse sticky text frame junction].freeze

  # 種類ごとの既定の大きさ。**用途に合った形で置かれる**ほうが、
  # 置いてから毎回そろえ直すより速い
  DEFAULT_SIZES = {
    "rectangle" => { width: 240, height: 160 },
    "ellipse" => { width: 200, height: 200 },
    # 付箋は正方形に近いほうが、貼ったものらしく見える
    "sticky" => { width: 180, height: 180 },
    # 文字は横に伸びる。高さは1行ぶん
    "text" => { width: 240, height: 48 },
    # かこみはカードが数枚入る大きさ
    "frame" => { width: 640, height: 480 },
    # 接合点は「点」。大きくすると図形に見えてしまう
    "junction" => { width: JUNCTION_SIZE = 14, height: 14 }
  }.freeze

  # 読める大きさの範囲。カードと同じ考え方（読めない／画面を覆う、を防ぐ）
  MIN_SIZE = 40
  MAX_SIZE = 4000
  # 接合点だけは別。**点なので、小さくないと点に見えない**
  MIN_JUNCTION_SIZE = 8
  MAX_JUNCTION_SIZE = 40

  MAX_TEXT_LENGTH = 2_000

  # 置いた直後の見た目。
  #
  # **何も塗らずに置くと、見えない図形が盤に増える。**
  # 四角も丸も、既定は盤とほとんど同じ色だったので、置いた本人にも
  # どこに出たのか分からなかった（掴めるのに見えない、がいちばん困る）。
  #
  # 主張しすぎない薄い色に、輪郭を添える。色は**あとから変えられる**ので、
  # ここでの役目は「置いたものが見えること」だけ。
  #
  # かこみ（frame）だけは塗らない。**中身が透けないと囲えない**
  DEFAULT_STYLES = {
    "rectangle" => { "fill" => "#eef2f7", "stroke" => "#94a3b8", "stroke_width" => 2 },
    "ellipse" => { "fill" => "#eef2f7", "stroke" => "#94a3b8", "stroke_width" => 2 },
    "sticky" => { "fill" => "#fff3b0", "stroke" => "#e5c76b", "stroke_width" => 1, "folded" => true },
    # 文字だけは塗りも枠も持たない。持たせると、見出しを置くたびに消す手間が要る
    "text" => {},
    "frame" => { "stroke" => "#94a3b8", "stroke_width" => 2, "dashed" => true },
    # 接合点は**線と同じ濃さの塗り丸**。回路図・家系図の作法にならう
    # （交差しているだけの所と、つながっている所を見分けるための印）
    "junction" => { "fill" => "#4a4a4a" }
  }.freeze

  belongs_to :view

  validates :kind, inclusion: { in: KINDS }
  validate :size_within_range
  validates :text, length: { maximum: MAX_TEXT_LENGTH }, allow_nil: true

  # 後ろから順に。**かこみは必ずいちばん後ろ**（前に出ると中身が隠れる）
  scope :ordered, -> { order(Arel.sql("CASE WHEN kind = 'frame' THEN 0 ELSE 1 END"), :z_index, :created_at) }

  # 線の端になれるもの。**かこみは端にしない**（中身を囲うためのもので、点ではない）
  scope :connectable, -> { where.not(kind: "frame") }

  def frame? = kind == "frame"
  def junction? = kind == "junction"

  def self.size_range_for(kind)
    kind == "junction" ? [ MIN_JUNCTION_SIZE, MAX_JUNCTION_SIZE ] : [ MIN_SIZE, MAX_SIZE ]
  end

  def self.default_size_for(kind)
    DEFAULT_SIZES.fetch(kind, DEFAULT_SIZES["rectangle"])
  end

  private

  # 大きさの許される範囲は種類で違う。**接合点は点なので、小さくてよい**
  def size_within_range
    low, high = self.class.size_range_for(kind)
    [ [ :width, width ], [ :height, height ] ].each do |name, value|
      next if value.present? && value >= low && value <= high

      errors.add(name, "は#{low}〜#{high}の範囲にしてください")
    end
  end

  public

  def self.default_style_for(kind)
    DEFAULT_STYLES.fetch(kind, DEFAULT_STYLES["rectangle"]).dup
  end
end
