# frozen_string_literal: true

class AddSourceDeckIdToViews < ActiveRecord::Migration[8.1]
  def change
    # デッキ→ビュー移行(Phase B)の冪等性・切替・撤去に使う一時カラム（B4で除去予定）。
    # どのデッキから移行された deck-view かを記録する。
    add_column :views, :source_deck_id, :uuid
    add_index :views, :source_deck_id, unique: true, where: "source_deck_id IS NOT NULL"
  end
end
