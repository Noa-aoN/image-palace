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
  # boolean は「済んだ / 済んでいない」を持つ。**未入力と false は違う。**
  # 触っていないのか、見て「違う」と決めたのかが読めないと、印の意味が無くなる
  # free_text は**見出しも中身も自由**に書ける欄。
  # 決まった項目に収まらないもの（そのカード限りのメモ・引用・気づき）のために置く。
  # 見出しを定義側で決めないので、同じ「自由欄」を何枚か持てる。
  # free_image は**自由な小見出しと、自由な指示で作る絵**。
  # カードの見出し語に縛られないので、そのカードの中の一場面・対比・図解などを持てる。
  # select は**選択肢を定義側が持つ**。ほかの型は「どう入力してどう表示するか」
  # だけで決まるが、これだけは「何を選べるか」が要る（`options`）
  # reading は**言語ごとの値をひとつの項目で持つ**。
  #
  # 「読み方」を言語ごとに別の定義にすると、1種別40個の枠を言語の数だけ食うし、
  # 基本の言語を変えても何も起きない。1つの項目の中に言語別の値を持てば、
  # **どれを主として出すかは、そのときの基本言語で決まる**（値は動かさない）。
  VALUE_TYPES = %w[
    text longtext list number date url boolean select reading free_text free_image wikipedia
  ].freeze

  # 1つの定義に置ける選択肢の数。**多すぎると選ぶより探すほうが大変になる**
  MAX_OPTIONS = 20
  MAX_OPTION_LENGTH = 40

  # 項目の役割。**何のために持つのか**で分ける。
  #
  # 分けないと、覚えるための手立てと、調べた事実が同じ見た目で並ぶ。
  # 「語源」と「語呂合わせ」は隣に置くと似て見えるが、
  # 前者は**合っているか**が大事で、後者は**思い出せるか**が大事。
  # 直したいときに、どちらの物差しで見ればよいかが変わる。
  CATEGORIES = %w[subject mnemonic admin].freeze
  DEFAULT_CATEGORY = "subject"

  CATEGORY_LABELS = {
    "subject" => "記憶要素",
    "mnemonic" => "変換要素",
    "admin" => "管理要素"
  }.freeze

  # 項目ごとの目印の色。**名前で持つ**（実際の色味は画面側が決める）。
  #
  # 役割の色は3つしかないので、同じ役割の中で「語源」「品詞」「読み方」を
  # 見分けたいときに手立てが無い。ここは**その人が自分の物差しで付ける印**。
  #
  # 生の `#RRGGBB` を持たないのは、地（アイボリー）に載る色が画面側の設計に
  # 属するため。生の値だと、色味を調整するたびに保存済みの行を書き換えることになる。
  COLORS = %w[gold purple blue green red orange pink gray].freeze

  MAX_KEY_LENGTH = 40
  MAX_LABEL_LENGTH = 40
  MAX_PER_ITEM_TYPE = 40

  # 機械が使う名前。英小文字・数字・アンダースコアだけに絞る
  KEY_FORMAT = /\A[a-z][a-z0-9_]*\z/

  validates :key, presence: true, length: { maximum: MAX_KEY_LENGTH }, format: { with: KEY_FORMAT }
  validates :label, presence: true, length: { maximum: MAX_LABEL_LENGTH }
  validates :value_type, inclusion: { in: VALUE_TYPES }
  validates :category, inclusion: { in: CATEGORIES }
  validate :options_must_fit
  validates :key, uniqueness: { scope: [ :user_id, :item_type_id ] }
  # 無色（付けていない）を既定にする。**全部に色が付くと、どれが目印か分からなくなる**
  validates :color, inclusion: { in: COLORS }, allow_nil: true

  scope :ordered, -> { order(:position, :created_at) }
  scope :for_item_type, ->(item_type_id) { where(item_type_id: item_type_id) }
  scope :of_category, ->(category) { where(category: category) }

  before_validation :assign_position, on: :create
  # 画面から空文字で送られてきたら「外した」とみなす。
  # そのまま入れると、無色でも有色でもない値が残る
  before_validation :blank_color_means_none

  def list?
    value_type == "list"
  end

  private

  def blank_color_means_none
    self.color = nil if color.blank?
  end

  def assign_position
    return if position.present? && position.positive?

    scope = PropertyDefinition.where(user_id: user_id, item_type_id: item_type_id)
    self.position = (scope.maximum(:position) || -1) + 1
  end

  def select?
    value_type == "select"
  end

  # 選択肢の決まり。
  #
  # **選ぶ項目には1つ以上要る。** 空のまま作ると、開いても選べない欄になる。
  # ほかの型には持たせない（持てると、型を変えたときに古い選択肢が残る）
  def options_must_fit
    list = Array(options).map { |o| o.to_s.strip }.reject(&:blank?)

    if select?
      errors.add(:options, "を1つ以上入れてください") if list.empty?
      errors.add(:options, "は#{MAX_OPTIONS}個までです") if list.size > MAX_OPTIONS
      errors.add(:options, "は#{MAX_OPTION_LENGTH}文字までです") if list.any? { |o| o.length > MAX_OPTION_LENGTH }
      errors.add(:options, "に同じものが入っています") if list.uniq.size != list.size
    elsif list.any?
      errors.add(:options, "は選ぶ項目にしか持たせられません")
    end
  end
end
