# frozen_string_literal: true

# 公式コンテンツの、公開された姿。
#
# 原本は公式アカウントの箱とキャンバスで、運営が普通の画面で育てる。
# ここに入るのは、その**ある時点を書き出したもの**。
#
#   原本を直す → もう一度公開する → v2 ができる
#
# **公開したものは動かさない。** 直したいときは新しい版を出す。
# 配ったあとで原本のカードを消しても、配布中の版は壊れない。
# `payload` が中身を丸ごと持っているため。
#
# 配る側（デモ・Starter・引き換えコード・将来の購入）は、
# どれも `install!` を呼ぶだけ。**入れる相手が違うだけで、やることは同じ。**
class ContentPackage < ApplicationRecord
  # demo     … はじまりの宮殿。使い捨ての利用者へ丸ごと入れる
  # starter  … 登録した人が1つだけ持ち帰る
  # advance  … 将来の本格教材（有料の候補）
  KINDS = %w[demo starter advance].freeze

  # draft     … 作りかけ。配らない
  # published … 配れる
  # archived  … もう配らない。既に受け取った人のものはそのまま
  STATUSES = %w[draft published archived].freeze

  # 鍵は URL や rake の引数に出るので、扱いやすい字だけにする
  KEY_FORMAT = /\A[a-z][a-z0-9_]{2,49}\z/

  validates :key, presence: true, format: { with: KEY_FORMAT, message: "は英小文字・数字・_ で3〜50字" }
  validates :version, numericality: { only_integer: true, greater_than: 0 }
  validates :version, uniqueness: { scope: :key }
  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :name, presence: true, length: { maximum: 100 }
  validate :payload_must_be_readable

  # **公開したものは動かさない。** 変えてよいのは扱い（status）だけ
  IMMUTABLE_AFTER_PUBLISH = %w[key version kind name summary cover_image_key payload published_at].freeze
  validate :refuse_changes_after_publish, on: :update

  scope :published, -> { where(status: "published") }
  scope :of_kind, ->(kind) { where(kind: kind) }
  # 鍵ごとに、新しい版から
  scope :ordered, -> { order(:key, version: :desc) }

  # その鍵の、いま配れる版。**デモは常にこれを使う**
  def self.latest_published(key)
    published.where(key: key).order(version: :desc).first
  end

  # 鍵ごとに1つずつ、いま配れる版を返す
  def self.distributable(kind: nil)
    scope = published
    scope = scope.of_kind(kind) if kind
    scope.order(:key, version: :desc).to_a.uniq(&:key)
  end

  # 書き出したものを、新しい版として公開する。
  #
  # 版は「いまある最大 + 1」。同時に2回押されると同じ番号を狙うが、
  # `(key, version)` の一意索引が必ず片方を落とすので、そこで1度だけ数え直す
  def self.publish!(key:, kind:, name:, payload:, summary: nil, cover_image_key: nil)
    attempts = 0
    begin
      attempts += 1
      create!(
        key: key, version: (where(key: key).maximum(:version).to_i + 1),
        kind: kind, status: "published", name: name, summary: summary,
        cover_image_key: cover_image_key, payload: payload, published_at: Time.current
      )
    rescue ActiveRecord::RecordNotUnique
      retry if attempts < 3
      raise
    end
  end

  # その人の宮殿へ入れる。
  #
  # `owned` は「その人が既に持っている公式のカード」（origin_key → カード）。
  # 同じカードを2枚にしないために、配る側が渡す
  def install!(user:, owned: {})
    ContentPackages::Importer.call(user: user, payload: payload, owned: owned)
  end

  # 受け取る前に見せる要約。**中身を開かずに数だけ分かる**ようにする
  def summary_counts
    {
      items: Array(payload["items"]).size,
      boxes: Array(payload["boxes"]).size,
      views: Array(payload["views"]).size,
      tags: Array(payload["items"]).flat_map { |i| Array(i["tags"]) }.uniq.size
    }
  end

  def published?
    status == "published"
  end

  def archive!
    update!(status: "archived")
  end

  private

  def payload_must_be_readable
    ContentPackages::Payload.validate!(payload)
  rescue ContentPackages::Payload::Error => e
    errors.add(:payload, e.message)
  end

  def refuse_changes_after_publish
    return unless status_was == "published"

    changed_columns = changed & IMMUTABLE_AFTER_PUBLISH
    return if changed_columns.empty?

    errors.add(:base, "公開済みの内容は変えられません（#{changed_columns.join(', ')}）。新しい版として公開してください")
  end
end
