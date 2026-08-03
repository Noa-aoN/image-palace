# frozen_string_literal: true

# 運営からユーザーへ届ける読みもの（お知らせ・更新情報・コラム）。
class Post < ApplicationRecord
  CATEGORIES = %w[news update column].freeze
  CATEGORY_LABELS = {
    "news" => "お知らせ",
    "update" => "更新情報",
    "column" => "コラム"
  }.freeze

  # 本文に使える塊の種類。フロント側の描画と合わせること
  BLOCK_TYPES = %w[p h2 ul quote].freeze

  TITLE_MAX_LENGTH = 200
  SLUG_FORMAT = /\A[a-z0-9][a-z0-9-]*\z/

  belongs_to :author, class_name: "User", optional: true

  validates :slug, presence: true, uniqueness: true, format: { with: SLUG_FORMAT }
  validates :category, inclusion: { in: CATEGORIES }
  validates :title, presence: true, length: { maximum: TITLE_MAX_LENGTH }
  validate :body_must_be_blocks

  scope :published, -> { where.not(published_at: nil).where(published_at: ..Time.current) }
  scope :in_category, ->(category) { CATEGORIES.include?(category.to_s) ? where(category: category) : all }
  # 留めたものを先頭に、あとは新しい順
  scope :for_listing, -> { order(pinned: :desc, published_at: :desc, created_at: :desc) }

  def published?
    published_at.present? && published_at <= Time.current
  end

  def delivered?
    delivered_at.present?
  end

  def category_label
    CATEGORY_LABELS[category] || category
  end

  # 平文から本文の塊を組み立てる。
  # 書く側に構造化を強いると続かないので、見出しと箇条書きだけ約束事にする。
  #   「## 」で始まる行 … 見出し
  #   「- 」で始まる行  … 箇条書き（続く行はまとめる）
  #   「> 」で始まる行  … 引用
  #   空行             … 段落の切れ目
  def self.blocks_from_text(text)
    blocks = []
    list = []

    flush_list = lambda do
      blocks << { "type" => "ul", "items" => list.dup } if list.any?
      list.clear
    end

    text.to_s.split(/\r?\n/).each do |raw|
      line = raw.strip
      if line.start_with?("- ")
        list << line.delete_prefix("- ").strip
        next
      end

      flush_list.call
      next if line.blank?

      if line.start_with?("## ")
        blocks << { "type" => "h2", "text" => line.delete_prefix("## ").strip }
      elsif line.start_with?("> ")
        blocks << { "type" => "quote", "text" => line.delete_prefix("> ").strip }
      else
        blocks << { "type" => "p", "text" => line }
      end
    end
    flush_list.call
    blocks
  end

  # 編集画面へ戻すための平文
  def body_as_text
    Array(body).filter_map do |block|
      case block["type"]
      when "h2" then "## #{block['text']}"
      when "quote" then "> #{block['text']}"
      when "ul" then Array(block["items"]).map { |item| "- #{item}" }.join("\n")
      else block["text"]
      end
    end.join("\n\n")
  end

  private

  # 知らない種類の塊は描けないので、保存の時点で弾く
  def body_must_be_blocks
    unless body.is_a?(Array)
      errors.add(:body, "の形式が正しくありません")
      return
    end

    return if body.all? { |block| block.is_a?(Hash) && BLOCK_TYPES.include?(block["type"].to_s) }

    errors.add(:body, "に扱えない種類が含まれています")
  end
end
