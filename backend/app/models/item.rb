class Item < ApplicationRecord
  belongs_to :user
  belongs_to :item_type
  has_many :meanings, dependent: :destroy
  has_many :medias, dependent: :destroy
  has_many :collection_items, dependent: :destroy
  has_many :collections, through: :collection_items
  has_many :deck_items, dependent: :destroy
  has_many :decks, through: :deck_items
  has_many :collection_entries, as: :entry, dependent: :destroy
  has_many :item_tags, dependent: :destroy
  has_many :tags, through: :item_tags
  has_many :from_relations, class_name: "Relation", foreign_key: :from_item_id, dependent: :destroy
  has_many :to_relations, class_name: "Relation", foreign_key: :to_item_id, dependent: :destroy
  has_many :view_items, dependent: :destroy
  has_many :views, through: :view_items
  # ロードのポイントに割り当て。カード削除時はポイントを空にする（nullify）
  has_many :road_points, dependent: :nullify

  GENERATION_STATUSES = %w[pending processing completed failed].freeze
  GENERATION_ERROR_KEYS = %w[generation_error generation_error_code].freeze
  MAX_TITLE_LENGTH = 100

  store_accessor :metadata, :generation_error, :generation_error_code, :style, :custom_prompt

  validates :title, presence: true, length: { maximum: MAX_TITLE_LENGTH }
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :style, inclusion: { in: PromptBuilderService::STYLES }, allow_blank: true
  validates :custom_prompt, length: { maximum: PromptBuilderService::CUSTOM_PROMPT_MAX_LENGTH }, allow_blank: true

  # 当月（月初〜）に作成されたアイテム。月間生成上限の判定・残量表示に使う
  scope :created_this_month, -> { where(created_at: Time.current.beginning_of_month..) }

  def primary_media
    if association(:medias).loaded?
      medias.min_by { |media| [ media.position || Float::INFINITY, media.created_at ] }
    else
      medias.ordered.first || medias.first
    end
  end

  # 表示・編集用の代表的な意味（日本語を優先）
  def primary_meaning
    if association(:meanings).loaded?
      meanings.find { |m| m.language_code == "ja" } || meanings.first
    else
      meanings.in_language("ja").first || meanings.first
    end
  end

  def metadata_without_generation_error
    (metadata || {}).except(*GENERATION_ERROR_KEYS)
  end

  def update_generation_status!(status)
    update!(generation_status: status, metadata: metadata_without_generation_error)
  end

  def mark_generation_failed!(message:, code: nil)
    update!(
      generation_status: "failed",
      metadata: metadata_without_generation_error.merge(
        "generation_error" => message,
        "generation_error_code" => code
      ).compact
    )
  end
end
