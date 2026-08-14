class SharedMedia < ApplicationRecord
  self.table_name = "shared_medias"

  belongs_to :user, optional: true
  has_one_attached :file
  # 一覧用サムネ（480px WebP）のキャッシュ。重複排除されたカードで共有する。
  has_one_attached :thumb

  validates :normalized_prompt, presence: true

  scope :for_prompt, ->(prompt) { where(normalized_prompt: prompt).order(created_at: :desc) }

  # 絵の実体をまとめて読む。**本体と縮小版は別の添付**なので、片方だけだと
  # 出すときにもう一度引きに行くことになる（行の数だけ問い合わせが増える）
  scope :with_files, lambda {
    includes({ file_attachment: :blob }, { thumb_attachment: :blob })
  }
end
