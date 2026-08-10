# カードとカードのつながり。
#
# 「関連カード」は**向きを持たない**ものとして扱う。A から B を関連づけたら、
# B の画面にも A が出る。向きを意識させると、同じつながりを2本作る人が出て、
# 消すときにどちらを消せばよいのか分からなくなる。
# 行は1本だけ持ち、読むときに両方向を見る。
class Relation < ApplicationRecord
  # つながりの種類。いまは「関連」だけを画面から作れる。
  # 種類を増やすときは、増やす理由（画面で何が変わるか）と一緒に足すこと
  RELATED = "related"
  TYPES = [ RELATED ].freeze

  belongs_to :user
  belongs_to :from_item, class_name: "Item"
  belongs_to :to_item, class_name: "Item"

  validates :relation_type, presence: true
  validates :from_item_id, comparison: { other_than: :to_item_id }
  validate :from_and_to_must_belong_to_same_user

  scope :of_type, ->(type) { where(relation_type: type) }
  scope :for_user, ->(user) { where(user: user) }
  # そのカードに繋がっているもの（向きを問わない）
  scope :touching, ->(item_id) { where(from_item_id: item_id).or(where(to_item_id: item_id)) }

  # 相手のカード
  def other_side(item_id)
    from_item_id == item_id ? to_item : from_item
  end

  private

  def from_and_to_must_belong_to_same_user
    return if from_item.user_id == to_item.user_id && from_item.user_id == user_id

    errors.add(:base, "Related items must belong to the same user")
  end
end
