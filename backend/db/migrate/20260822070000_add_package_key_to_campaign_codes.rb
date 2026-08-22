# frozen_string_literal: true

# 引き換えコードで**公式コンテンツを配る**ための鍵。
#
# これまでコードで渡せたのはクレジットだけだった。
# 「この講座の受講生に、この単語集を配る」ができない。
#
# ## なぜ列を足すか
#
# `item_kind` を流用することもできるが、あれは獲得物（勲章・宝物）の種類で、
# 荷物の鍵とは別のもの。同じ列に2種類の意味を入れると、
# 読むたびに `reward_type` を見て解釈を変えることになる。
#
# ## 版は持たない
#
# 「`starter_it` を配る」はその線に対する約束であって、v3 に対する約束ではない。
# 配る時点で**いちばん新しい公開版**を渡す（デルフォイと同じ決まり）。
class AddPackageKeyToCampaignCodes < ActiveRecord::Migration[8.1]
  def change
    add_column :campaign_codes, :package_key, :string
  end
end
