class Setting < ApplicationRecord
  # 新規カードの既定の縦横比（カード側で個別に上書きできる）
  validates :default_aspect_ratio, inclusion: { in: AspectRatios::KEYS }
  # 図（間取り図・記憶資産など）の表現。
  DIAGRAM_MODES = %w[2d 3d].freeze
  # アニメーションの扱い。auto は端末（OS）の prefers-reduced-motion に従う。
  MOTION_MODES = %w[auto on off].freeze

  belongs_to :user

  validates :user_id, uniqueness: true
  validates :diagram_mode, inclusion: { in: DIAGRAM_MODES }
  validates :motion_mode, inclusion: { in: MOTION_MODES }
  # 新規カードのデフォルト画像スタイル。空文字は「おまかせ（指定なし）」を許容する。
  validates :default_image_style, inclusion: { in: PromptBuilderService::STYLES }, allow_blank: true
end
