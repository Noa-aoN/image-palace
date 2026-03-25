class RenameObjectTypesToItemTypes < ActiveRecord::Migration[8.1]
  def change
    # インデックスを先にリネーム（PostgreSQLはテーブルリネームでもインデックス名は変わらない）
    rename_index :object_types, :index_object_types_on_name, :index_item_types_on_name
    rename_table :object_types, :item_types
    # 注意: 将来的に外部キーを持つテーブルから参照される場合、
    #       その外部キーも更新する必要があります
  end
end
