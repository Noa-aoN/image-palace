class AddItemReadIndexes < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_index :items, [ :user_id, :created_at ],
      name: "index_items_on_user_id_and_created_at",
      algorithm: :concurrently,
      if_not_exists: true

    add_index :items, [ :user_id, :generation_status, :created_at ],
      name: "index_items_on_user_id_status_created_at",
      algorithm: :concurrently,
      if_not_exists: true

    add_index :items, [ :user_id, :title, :created_at ],
      name: "index_items_on_user_id_title_created_at",
      algorithm: :concurrently,
      if_not_exists: true
  end
end
