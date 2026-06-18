class AddCoverToViews < ActiveRecord::Migration[8.1]
  def change
    # デッキ踏襲のカバー設定。cover_item_id はビューに配置したカード（Item）を表紙に指定。
    add_column :views, :cover_item_id, :uuid
    add_column :views, :cover_type, :string, null: false, default: "first_card"
    add_foreign_key :views, :items, column: :cover_item_id, on_delete: :nullify
    add_index :views, :cover_item_id
  end
end
