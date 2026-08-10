class Item < ApplicationRecord
  # カード画像の縦横比（定義は AspectRatios に集約）
  validates :aspect_ratio, inclusion: { in: AspectRatios::KEYS }
  belongs_to :user
  belongs_to :item_type
  has_many :meanings, dependent: :destroy
  has_many :item_properties, dependent: :destroy
  has_many :item_reviews, dependent: :destroy
  has_many :medias, dependent: :destroy
  has_many :box_items, dependent: :destroy
  has_many :boxes, through: :box_items
  has_many :box_entries, as: :entry, dependent: :destroy
  has_many :item_tags, dependent: :destroy
  has_many :tags, through: :item_tags
  has_many :from_relations, class_name: "Relation", foreign_key: :from_item_id, dependent: :destroy
  has_many :to_relations, class_name: "Relation", foreign_key: :to_item_id, dependent: :destroy
  has_many :view_items, dependent: :destroy
  has_many :views, through: :view_items
  # ロード種別スペースのポイントに割り当て。カード削除時はポイントを空にする（nullify）
  has_many :space_points, dependent: :nullify

  # 絵を作るモデルの指定。null は「おまかせ」＝そのときの既定。
  #
  # 選べないキー（鍵が外された・古い指定が残っている）は保存時に null へ丸める。
  # 弾いてしまうと、鍵を1つ外しただけで過去のカードが編集できなくなる。
  before_validation :normalize_image_model

  GENERATION_STATUSES = %w[pending processing completed failed].freeze
  GENERATION_ERROR_KEYS = %w[generation_error generation_error_code generation_failure_kind].freeze
  MAX_TITLE_LENGTH = 100
  # 画像の下ごしらえ（説明文・情景プロンプト）の状態。none は未使用・無効時
  BRIEF_STATUSES = %w[none pending processing completed failed].freeze
  MAX_IMAGE_DESCRIPTION_LENGTH = 2000
  MAX_SCENE_PROMPT_LENGTH = 1000

  # 画像への指示をどう作るか。空（未指定）は brief と同じ＝既定の経路。
  #   word     … 単語をそのまま画像生成へ渡す（下ごしらえ無し。最初期のやり方）
  #   brief    … 単語から説明文と情景を起こす（IMAGE_BRIEF_ENABLED の既定の経路）
  #   research … 先に意味・説明を調べ、それをもとに指示を書き直す
  #
  # カードごとに覚える。作り直しのときも同じ経路をたどらないと、
  # 「単語そのまま」で作ったカードが作り直しただけで別のやり方に化ける。
  PROMPT_SOURCES = %w[word brief research].freeze
  DEFAULT_PROMPT_SOURCE = "brief"

  store_accessor :metadata, :generation_error, :generation_error_code, :generation_failure_kind,
                 :style, :custom_prompt, :framing,
                 :prompt_source, :block_view

  # カード1枚ごとの見え方（どのブロックを出すか・並び順）。
  # 中身は { "hidden" => [key...], "order" => [key...] }。
  # 種別の設定（どの項目を持つか）とは別で、こちらは**この1枚だけ**に効く。
  MAX_BLOCK_KEYS = 100
  MAX_BLOCK_KEY_LENGTH = 64

  validates :title, presence: true, length: { maximum: MAX_TITLE_LENGTH }
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :style, inclusion: { in: PromptBuilderService::STYLES }, allow_blank: true
  validates :custom_prompt, length: { maximum: PromptBuilderService::CUSTOM_PROMPT_MAX_LENGTH }, allow_blank: true
  validates :framing, inclusion: { in: PromptBuilderService::FRAMINGS }, allow_blank: true
  validates :prompt_source, inclusion: { in: PROMPT_SOURCES }, allow_blank: true
  validates :brief_status, inclusion: { in: BRIEF_STATUSES }
  validates :image_description, length: { maximum: MAX_IMAGE_DESCRIPTION_LENGTH }, allow_blank: true
  validates :scene_prompt, length: { maximum: MAX_SCENE_PROMPT_LENGTH }, allow_blank: true

  # 当月（月初〜）に作成されたアイテム。月間生成上限の判定・残量表示に使う
  scope :created_this_month, -> { where(created_at: Time.current.beginning_of_month..) }

  # 生成が pending/processing のまま滞留している孤児候補。
  # デプロイ/再起動で Solid Queue のワーカーが pruned されると処理中ジョブが失われ、
  # アイテムが「生成中」のまま取り残される。cutoff より更新が古いものを stuck とみなす。
  scope :stuck_generation, ->(cutoff) {
    where(generation_status: %w[pending processing]).where(updated_at: ..cutoff)
  }

  # 隠しているブロックのキー。未設定なら空
  def hidden_block_keys
    Array((block_view || {})["hidden"])
  end

  # そのカードでは持たない項目。畳んでいる（hidden）のとは意味が違う。
  # 持たない項目は AI の穴埋めの対象からも外す
  def omitted_block_keys
    Array((block_view || {})["omitted"])
  end

  # 並び順の指定。未設定なら空（画面側の既定の並びを使う）
  def ordered_block_keys
    Array((block_view || {})["order"])
  end

  # 未指定のカード（旧データ・既定のまま作られたもの）は既定の経路として扱う
  def effective_prompt_source
    prompt_source.presence || DEFAULT_PROMPT_SOURCE
  end

  def normalize_image_model
    return if image_model.blank?

    self.image_model = nil unless GenerateImageService.selectable_key?(image_model)
  end

  def primary_media
    if association(:medias).loaded?
      medias.min_by { |media| [ media.position || Float::INFINITY, media.created_at ] }
    else
      medias.ordered.first || medias.first
    end
  end

  # 表示・編集用の代表的な意味（日本語を優先）。
  # 複数持てるようになったので、同じ言語が並んだときは position の先頭を代表にする。
  #
  # 並べ替えはメモリ上で行う。`meanings.ordered` のようにスコープを挟むと Relation になり、
  # まだ保存していないカード（build して meanings.build した状態）で組み立てた中身が
  # 見えなくなる。プロンプト組み立てはその状態でも通るので、ここで落とせない。
  def primary_meaning
    sorted = meanings.to_a.sort_by { |m| [ m.position || Float::INFINITY, m.created_at || Time.zone.at(0) ] }
    sorted.find { |m| m.language_code == "ja" } || sorted.first
  end

  # ユーザーが説明文・情景プロンプトを手で直したか。直したものは自動生成で上書きしない
  def brief_edited?
    brief_edited_at.present?
  end

  def metadata_without_generation_error
    (metadata || {}).except(*GENERATION_ERROR_KEYS)
  end

  def update_generation_status!(status)
    next_metadata = metadata_without_generation_error
    # 出来上がったら、無料の作り直し回数は0に戻す。
    # 残したままだと、ずっと後で1回失敗しただけで即クレジットを取ることになる
    next_metadata = next_metadata.except("free_retries") if status == "completed"
    update!(generation_status: status, metadata: next_metadata)
  end

  # kind は失敗の種類（ImageGenerationErrorHandling::FAILURE_KINDS）。
  # 「もう一度押して直るのか」を、押す前に判断するために残す
  def mark_generation_failed!(message:, code: nil, kind: nil)
    update!(
      generation_status: "failed",
      metadata: metadata_without_generation_error.merge(
        "generation_error" => message,
        "generation_error_code" => code,
        "generation_failure_kind" => kind
      ).compact
    )
  end
end
