# frozen_string_literal: true

# 覆いの濃さを、段ではなく**目盛り**で持つ。
#
# ## なぜ3段では足りないか
#
# 薄い / 標準 / 濃いの3つに丸めていたが、覆いの用は
# 「**細部は読めない／構図は掴める**」の境目に置くことで、
# その境目は絵の中身と、見る人と、その場（人前かどうか）で変わる。
# 3つに丸めると、ちょうどよい所が段と段の間に落ちる。
#
# ## 段の列は消さない
#
# 型を変える・列を消すのは戻せないので、段階を分ける
# （追加 → 移行 → 削除を別のデプロイに）。ここは**追加と移行まで**。
# `image_safeguard_strength` は残したまま、読むのをやめる。
#
# ## 移した先の値
#
# 見え方が変わらないように、いまのぼかし量から逆算して置く。
#   light  →  17（ぼかし 12px 相当）
#   normal →  50（ぼかし 24px 相当・既定）
#   strong →  94（ぼかし 40px 相当）
class AddImageSafeguardLevelToSettings < ActiveRecord::Migration[8.1]
  def up
    add_column :settings, :image_safeguard_level, :integer, default: 50, null: false

    # 既に段を選んでいる人の見え方を変えない
    execute <<~SQL.squish
      UPDATE settings SET image_safeguard_level = CASE image_safeguard_strength
        WHEN 'light' THEN 17
        WHEN 'strong' THEN 94
        ELSE 50
      END
    SQL
  end

  def down
    remove_column :settings, :image_safeguard_level
  end
end
