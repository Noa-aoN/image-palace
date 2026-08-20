# frozen_string_literal: true

# 「このカードは出さない」。**公式宮殿の中で、配らないと決めたもの。**
#
# 公式宮殿にあるもの全部が公開物ではない。ふだんは箱とキャンバスを選ぶことで
# 出すものを決めるが、**箱の中に1枚だけ出したくないカードが混じる**ことがある。
# そのために箱を分けるのは、原本の作りを配布の都合で歪める。
#
# ## なぜ「出す」ではなく「出さない」を持つのか
#
# 出すかどうかは、箱とキャンバスの選択から**導ける**。
# ここに「出す」も持たせると同じことを2か所で持つことになり、
# 箱から外したのにカード側が「出す」のまま、という食い違いが生まれる。
#
# 持つのは例外だけにする。**行が無ければ、箱の選択どおり。**
class CreateContentExclusions < ActiveRecord::Migration[8.1]
  def change
    create_table :content_exclusions, id: :uuid do |t|
      t.references :item, null: false, type: :uuid, foreign_key: { on_delete: :cascade },
                          index: { unique: true }
      # なぜ出さないのか。あとで自分が見て思い出せるように
      t.string :note

      t.timestamps
    end
  end
end
