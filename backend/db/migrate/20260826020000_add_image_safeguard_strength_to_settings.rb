# frozen_string_literal: true

# 覆いの濃さ。
#
# ## なぜ入り／切りだけでは足りないか
#
# 覆いは「細部が読めない／構図は掴める」の境目に置いてある（ぼかし 24px）。
# だがこの境目は人によって違う。
#
#   ・不意打ちを避けたいだけの人 …… もう少し薄くて、何の絵か分かるほうがよい
#   ・人前で開く人 ……………………… もっと濃く、色の気配すら残さないほうがよい
#
# 1つの値に決めると、どちらかが必ず困る。**掛けるかどうか**（`image_safeguard`）とは
# 別の軸なので、別の列で持つ。
#
# ## 既定は今までと同じ
#
# `normal` が現行の見え方（24px）。既存の利用者の見え方は変わらない。
class AddImageSafeguardStrengthToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :image_safeguard_strength, :string, default: "normal", null: false
  end
end
