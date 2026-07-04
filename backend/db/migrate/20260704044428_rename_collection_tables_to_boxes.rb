# 「コレクション」→「ボックス」改名に伴い、テーブル/FKカラムを rename する。
# モデル/コントローラ/URL/表示は既に Box/ボックス へ統一済み。Postgres の rename は
# 高速なメタ操作（データコピー無し）。既定命名のインデックスは rename_table が追随する。
class RenameCollectionTablesToBoxes < ActiveRecord::Migration[8.1]
  def change
    rename_table :collections, :boxes
    rename_table :collection_items, :box_items
    rename_table :collection_entries, :box_entries
    rename_table :space_collections, :space_boxes

    rename_column :box_items, :collection_id, :box_id
    rename_column :box_entries, :collection_id, :box_id
    rename_column :space_boxes, :collection_id, :box_id
  end
end
