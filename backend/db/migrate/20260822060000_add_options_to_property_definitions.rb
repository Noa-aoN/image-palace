# frozen_string_literal: true

# 選ぶ項目（`select`）の選択肢。
#
# ## なぜ列が要るか
#
# ほかの型は「どう入力してどう表示するか」だけで決まるが、選ぶ項目は
# **何を選べるか**を定義側が持たないと成り立たない。
# 「状態」なら 下書き / 確認待ち / 完成 のように、その人が決める。
#
# ## なぜ別の表にしないか
#
# 選択肢は**その定義にしか属さない**（並び順も含めて）。
# 表を分けると、定義を消したときの後始末と、並べ替えの持ち方が増えるだけで、
# 別々に引きたい場面が無い。
#
# ## 既定は空
#
# 選ぶ項目以外は空のまま。`select` のときだけ、1つ以上を求める。
class AddOptionsToPropertyDefinitions < ActiveRecord::Migration[8.1]
  def change
    add_column :property_definitions, :options, :jsonb, default: [], null: false
  end
end
