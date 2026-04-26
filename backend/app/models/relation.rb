class Relation < ApplicationRecord
  belongs_to :user
  belongs_to :from_item, class_name: "Item"
  belongs_to :to_item, class_name: "Item"

  validates :relation_type, presence: true
  validates :from_item_id, comparison: { other_than: :to_item_id }
  validate :from_and_to_must_belong_to_same_user

  scope :of_type, ->(type) { where(relation_type: type) }
  scope :for_user, ->(user) { where(user: user) }

  private

  def from_and_to_must_belong_to_same_user
    return if from_item.user_id == to_item.user_id && from_item.user_id == user_id

    errors.add(:base, "Related items must belong to the same user")
  end
end
