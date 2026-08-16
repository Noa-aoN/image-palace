class DefaultCardDetailColumnsToTwo < ActiveRecord::Migration[8.0]
  # カード詳細の既定を2列にする。
  #
  # 1列だと、項目が増えるほど下へ長くなり、上下に振らないと全体が見えない。
  # 机の画面なら2列で一望できる（狭い窓では画面側が自動で1列へ戻す）。
  #
  # **既に自分で決めた人の値は動かさない。** 触っていない人は既定の 1 のままなので、
  # 「1 を選んだ人」と区別が付かない。ここで一括更新すると、
  # わざわざ1列にした人の設定を黙って変えることになる。
  # 既定値だけを変え、これから作られる行に効かせる
  def up
    change_column_default :settings, :card_detail_columns, from: 1, to: 2
  end

  def down
    change_column_default :settings, :card_detail_columns, from: 2, to: 1
  end
end
