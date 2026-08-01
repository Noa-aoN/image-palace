# frozen_string_literal: true

class AddAspectRatioToItems < ActiveRecord::Migration[8.1]
  def change
    # カード画像の縦横比。既存カードは全て正方形で生成済みなので既定を square にする。
    add_column :items, :aspect_ratio, :string, default: "square", null: false
    # 新規作成時の既定（ユーザーごと）。カード側で個別に上書きできる。
    add_column :settings, :default_aspect_ratio, :string, default: "square", null: false
  end
end
