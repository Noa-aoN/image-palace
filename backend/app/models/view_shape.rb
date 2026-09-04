# frozen_string_literal: true

# ボードに置く図形。
#
# ## 5種類に絞った理由
#
# 図を描く道具（Figma / Miro / FigJam など）が共通して持っているものだけにした。
# 種類を増やすと、選ぶ手間が増えるわりに、できる図はほとんど変わらない。
#
#   rectangle … 四角。囲む・区切る
#   ellipse   … 丸。強調する・始点と終点を表す
#   sticky    … 付箋。思いつきを置く（塗りがあり、文字が主役）
#   text      … 文字だけ。見出し・注釈（枠も塗りも無い）
#   frame     … かこみ。**カードの後ろに敷いて群れを囲う**
#
# frame だけは扱いが違う。**いちばん後ろに置き、掴んでも中のカードを動かさない。**
# 前に出ると中身が隠れ、掴めるとカードごと動いてしまう。
class ViewShape < ApplicationRecord
  KINDS = %w[rectangle ellipse sticky text frame].freeze

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
    "frame" => { width: 640, height: 480 }
  }.freeze

  # 読める大きさの範囲。カードと同じ考え方（読めない／画面を覆う、を防ぐ）
  MIN_SIZE = 40
  MAX_SIZE = 4000

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
    "frame" => { "stroke" => "#94a3b8", "stroke_width" => 2, "dashed" => true }
  }.freeze

  belongs_to :view

  validates :kind, inclusion: { in: KINDS }
  validates :width, :height,
            numericality: { greater_than_or_equal_to: MIN_SIZE, less_than_or_equal_to: MAX_SIZE }
  validates :text, length: { maximum: MAX_TEXT_LENGTH }, allow_nil: true

  # 後ろから順に。**かこみは必ずいちばん後ろ**（前に出ると中身が隠れる）
  scope :ordered, -> { order(Arel.sql("CASE WHEN kind = 'frame' THEN 0 ELSE 1 END"), :z_index, :created_at) }

  def frame? = kind == "frame"

  def self.default_size_for(kind)
    DEFAULT_SIZES.fetch(kind, DEFAULT_SIZES["rectangle"])
  end

  def self.default_style_for(kind)
    DEFAULT_STYLES.fetch(kind, DEFAULT_STYLES["rectangle"]).dup
  end
end
