class Tag < ApplicationRecord
  belongs_to :user
  has_many :item_tags, dependent: :destroy
  has_many :items, through: :item_tags

  NAME_MAX_LENGTH = 50

  # 各ユーザーに初期付与するデフォルトタグ。
  # メイン分類（pinned=目立つ）＝科学5分類＋芸術・創作／実用・生活／その他。
  # NDC 補完（pinned=false の「一応」プリセット。メインと同名・カバー済みは除外）。
  DEFAULT_TAGS = [
    { name: "形式科学", pinned: true },
    { name: "自然科学", pinned: true },
    { name: "社会科学", pinned: true },
    { name: "人文科学", pinned: true },
    { name: "応用科学", pinned: true },
    { name: "芸術・創作", pinned: true },
    { name: "実用・生活", pinned: true },
    { name: "その他", pinned: true },
    { name: "総記", pinned: false },
    { name: "哲学", pinned: false },
    { name: "歴史", pinned: false },
    { name: "技術・工学", pinned: false },
    { name: "産業", pinned: false },
    { name: "言語", pinned: false },
    { name: "文学", pinned: false }
  ].freeze

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH },
                   uniqueness: { scope: :user_id, case_sensitive: false }

  scope :ordered, -> { order(:name) }

  # ユーザーにデフォルトタグを付与する（冪等：同名タグがあればスキップ）。
  def self.assign_defaults_to(user)
    DEFAULT_TAGS.each do |attrs|
      next if user.tags.where("LOWER(name) = ?", attrs[:name].downcase).exists?

      user.tags.create!(name: attrs[:name], pinned: attrs[:pinned])
    end
  end
end
