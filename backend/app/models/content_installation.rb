# frozen_string_literal: true

# 公式コンテンツを受け取った、その1回。
#
# 荷物そのものではなく**鍵と版**を持つ。受け取ったあとで荷物を片付けても、
# 「その人が何を受け取ったか」は残る。
class ContentInstallation < ApplicationRecord
  # どこから受け取ったか。**再取得の鍵ではなく、記録**。
  #
  # 「ミッションでもう1つ」は別の箱を取ることを指す。
  # 同じ箱を2回持っても、カードが二重に増えるだけで意味が無い
  SOURCES = %w[
    starter_free demo_signup delphi
    mission campaign gift purchase admin_grant
    preview
  ].freeze

  # 下見。**受け取りとして数えない**（配布数にも無料枠にも入らない）。
  # 印を付けておくと、あとで片付けられる
  PREVIEW_SOURCE = "preview"

  # 無料で受け取れる本数。**DB の制約にはしない。**
  # 部分索引で焼き付けると、数を変えたいときに migration が要る
  FREE_SOURCES = %w[starter_free delphi].freeze
  FREE_LIMIT = 1

  belongs_to :user
  has_many :entries, class_name: "ContentInstallationEntry", dependent: :destroy

  validates :package_key, presence: true
  validates :package_version, numericality: { only_integer: true, greater_than: 0 }
  validates :source, inclusion: { in: SOURCES }
  validates :package_key, uniqueness: { scope: :user_id }

  scope :free, -> { where(source: FREE_SOURCES) }
  scope :real, -> { where.not(source: PREVIEW_SOURCE) }
  scope :recent, -> { order(installed_at: :desc) }

  def package
    ContentPackage.find_by(key: package_key, version: package_version)
  end

  # その人が既に持っている、公式由来のカード。
  # **同じカードを2枚にしない**ために、取り込む側へ渡す（origin_key → カード）
  def self.owned_items_for(user)
    rows = ContentInstallationEntry
             .joins(:content_installation)
             .where(content_installations: { user_id: user.id }, record_type: "Item")
             .where.not(origin_key: nil)
             .pluck(:origin_key, :record_id)
    return {} if rows.empty?

    items = Item.where(id: rows.map(&:last), user_id: user.id).index_by(&:id)
    rows.filter_map { |origin, id| [ origin, items[id] ] if items[id] }.to_h
  end

  # 無料の枠をもう使い切っているか
  def self.free_used?(user)
    free.where(user_id: user.id).count >= FREE_LIMIT
  end
end
