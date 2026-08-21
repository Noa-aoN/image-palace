# frozen_string_literal: true

# 「このカードは出さない」。**公式宮殿の中で、配らないと決めたもの。**
#
# 出すかどうかは、箱とキャンバスの選択から導ける。
# ここに「出す」も持たせると同じことを2か所で持つことになるので、
# **持つのは例外だけ**にしてある。行が無ければ、箱の選択どおり。
#
# 効くのは**次に起こす下書きから**。すでに出した荷物は動かない
# （公開したものは変えない決まりなので、外したいなら出し直す）。
class ContentExclusion < ApplicationRecord
  belongs_to :item

  validates :item_id, uniqueness: true

  # 出さないと決めたカードの id。**書き出しは1回引いて使い回す**
  def self.item_id_set
    pluck(:item_id).to_set
  end

  # 出す・出さないを切り替える。**押すたびに行が増えない**
  def self.set!(item:, excluded:, note: nil)
    if excluded
      row = find_or_initialize_by(item_id: item.id)
      row.note = note
      row.save!
      row
    else
      find_by(item_id: item.id)&.destroy
      nil
    end
  end
end
