# frozen_string_literal: true

# カードが持つ項目の定義。種別ごとに、利用者が自分で決める。
#
# 型を絞ってあるのが要。分野ごとに項目を足していくと際限がないが、
# 「どう入力してどう表示するか」の型は数種類で足りる。
# 新しい分野は、新しい型ではなく**定義の組み合わせ**で表す。
#
# ここに無いもの（意図的に持たせない型）:
#   翻訳 …… meanings が language_code を持つ。そちらで扱う
#   関連カード … relations（relation_type 付き）で扱う
#   画像 …… medias で扱う
# 同じものを2か所で持つと必ず食い違うので、既にある仕組みへ寄せる。
class PropertyDefinition < ApplicationRecord
  belongs_to :user
  belongs_to :item_type
  has_many :item_properties, dependent: :destroy

  # wikipedia は「調べた結果」を持つ型。url で代用しない。
  # url だと手で貼ったリンクにしかならず、冒頭も出典表記も持てない
  VALUE_TYPES = %w[text longtext list number date url wikipedia].freeze

  MAX_KEY_LENGTH = 40
  MAX_LABEL_LENGTH = 40
  MAX_PER_ITEM_TYPE = 40

  # 機械が使う名前。英小文字・数字・アンダースコアだけに絞る
  KEY_FORMAT = /\A[a-z][a-z0-9_]*\z/

  validates :key, presence: true, length: { maximum: MAX_KEY_LENGTH }, format: { with: KEY_FORMAT }
  validates :label, presence: true, length: { maximum: MAX_LABEL_LENGTH }
  validates :value_type, inclusion: { in: VALUE_TYPES }
  validates :key, uniqueness: { scope: [ :user_id, :item_type_id ] }

  scope :ordered, -> { order(:position, :created_at) }
  scope :for_item_type, ->(item_type_id) { where(item_type_id: item_type_id) }

  before_validation :assign_position, on: :create

  def list?
    value_type == "list"
  end

  private

  def assign_position
    return if position.present? && position.positive?

    scope = PropertyDefinition.where(user_id: user_id, item_type_id: item_type_id)
    self.position = (scope.maximum(:position) || -1) + 1
  end
end
