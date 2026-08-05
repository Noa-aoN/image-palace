# frozen_string_literal: true

# 単語生成の既定の難しさ。
#
# アクロポリスもデルフォイも、同じ水準の語ばかりが出ると使い道が狭まる。
# 学ぶ人の段階に合わせて振れ幅を変えられるようにする。
class AddWordDifficultyToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :word_difficulty, :string, null: false, default: "normal"
  end
end
