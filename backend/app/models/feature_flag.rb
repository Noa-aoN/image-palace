# frozen_string_literal: true

# 作りかけの機能を、どこまで見せるかの設定。
#
# 行が無ければ DEFAULTS の段階で動く。運営が画面から変えたときだけ行ができる。
# コードから消せない（＝画面が参照している）キーだけをここに並べる。
class FeatureFlag < ApplicationRecord
  # 見せ方の段階。
  #
  # hidden      … 入口ごと出さない。存在を知らせたくないとき
  # development … 「開発中」と出すが触れない。予告として見せたいとき
  # prototype   … 触れる。ただし「プロトタイプ版」と明示して、粗さを了解してもらう
  # released    … 普通の機能。印は付けない
  STAGES = %w[hidden development prototype released].freeze

  STAGE_LABELS = {
    "hidden" => "表示しない",
    "development" => "開発中",
    "prototype" => "プロトタイプ版",
    "released" => "公開"
  }.freeze

  # 画面が参照しているキーと既定の段階。
  # ここに無いキーは保存できない（打ち間違いで効かない設定が増えるのを防ぐ）
  DEFAULTS = {
    # 実績・メダル・称号は出せるようになったが、バッジ・活動記録・公開実績はまだ。
    # 触れる状態で印を付けて出す
    "trophy" => { label: "トロフィー・称号", stage: "prototype" },
    "study_game" => { label: "プレイ（カルタ・神経衰弱）", stage: "prototype" },
    "material_picture_list" => { label: "ピクチャーリスト", stage: "development" }
  }.freeze

  validates :key, presence: true, uniqueness: true, inclusion: { in: DEFAULTS.keys }
  validates :stage, inclusion: { in: STAGES }

  # キー → 段階。画面はこれだけを見る
  def self.stages
    overrides = pluck(:key, :stage).to_h
    DEFAULTS.transform_values { |d| d[:stage] }.merge(overrides.slice(*DEFAULTS.keys))
  end

  # 運営画面用。既定との違いが分かる形で返す
  def self.overview
    rows = all.index_by(&:key)
    DEFAULTS.map do |key, default|
      record = rows[key]
      {
        key: key,
        label: default[:label],
        stage: record&.stage || default[:stage],
        default_stage: default[:stage],
        customized: record.present? && record.stage != default[:stage],
        notes: record&.notes
      }
    end
  end
end
