class Setting < ApplicationRecord
  belongs_to :user

  validates :user_id, uniqueness: true
  # 新規カードのデフォルト画像スタイル。空文字は「おまかせ（指定なし）」を許容する。
  validates :default_image_style, inclusion: { in: PromptBuilderService::STYLES }, allow_blank: true
end
