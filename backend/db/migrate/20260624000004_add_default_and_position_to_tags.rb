# frozen_string_literal: true

class AddDefaultAndPositionToTags < ActiveRecord::Migration[8.1]
  def change
    # is_default: デフォルト（プリセット）タグの識別（UIで区別。削除は可）。
    # position: デフォルトタグの並び順（指定順に表示）。ユーザー作成タグは nil。
    add_column :tags, :is_default, :boolean, default: false, null: false
    add_column :tags, :position, :integer
  end
end
