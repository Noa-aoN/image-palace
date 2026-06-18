class AddCoverToCollections < ActiveRecord::Migration[8.1]
  def change
    # デッキ踏襲のカバー設定。cover_item_id はコレクション内の Item を表紙に指定。
    # custom カバー画像は ActiveStorage（cover_image）で添付する。
    add_column :collections, :cover_item_id, :uuid
    add_column :collections, :cover_type, :string, null: false, default: "first_card"
    add_foreign_key :collections, :items, column: :cover_item_id, on_delete: :nullify
    add_index :collections, :cover_item_id
  end
end
