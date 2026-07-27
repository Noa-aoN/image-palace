class TagGroupItem < ApplicationRecord
  belongs_to :tag_group
  belongs_to :tag

  validates :tag_id, uniqueness: { scope: :tag_group_id }
  validate :tag_and_group_same_user

  private

  # タグとグループが同一ユーザーのものであることを保証する（他ユーザーの混入防止）。
  def tag_and_group_same_user
    return if tag.blank? || tag_group.blank?
    return if tag.user_id == tag_group.user_id

    errors.add(:tag, "はグループと同じユーザーのものではありません")
  end
end
