# frozen_string_literal: true

# 画像以外の AI 利用（文章生成）1回ぶんの記録。追記のみで書き換えない。
class AiUsage < ApplicationRecord
  # created_at だけを持つ（更新しないため updated_at は無い）
  self.record_timestamps = false

  belongs_to :user, optional: true

  # 呼び出しの種類。表示ラベルもここに揃える
  KINDS = {
    "meaning" => "意味・説明の生成",
    "tags" => "タグの生成",
    "fact_check" => "ファクトチェック",
    "brief" => "画像の下ごしらえ",
    "scene_rewrite" => "情景の書き直し",
    "fill_properties" => "プロパティの穴埋め",
    "words_generate" => "単語の生成",
    "words_check" => "単語の確認",
    "canvas_edit" => "キャンバスのAI編集",
    "canvas_card_proposal" => "カードの提案"
  }.freeze

  validates :kind, presence: true
  validates :model, presence: true

  scope :since, ->(time) { where(created_at: time..) }

  def self.label_for(kind)
    KINDS[kind] || kind
  end

  def total_tokens
    prompt_tokens + completion_tokens
  end
end
