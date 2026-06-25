# frozen_string_literal: true

class AddDetailLevelToMeanings < ActiveRecord::Migration[8.1]
  def change
    # 説明の詳しさレベル（brief=ひとこと / simple=シンプル / detailed=くわしく）。既定は simple。
    add_column :meanings, :detail_level, :string, default: "simple", null: false
  end
end
