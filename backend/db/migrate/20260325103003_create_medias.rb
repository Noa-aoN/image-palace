class CreateMedias < ActiveRecord::Migration[8.1]
  def change
    create_table :medias, id: :uuid do |t|
      t.uuid :item_id, null: false
      t.string :media_type, null: false
      t.text :url, null: false
      t.jsonb :metadata, null: false, default: {}
      t.integer :position

      t.timestamps
    end

    add_index :medias, :item_id
    add_index :medias, [ :item_id, :position ]
    add_foreign_key :medias, :items, on_delete: :cascade
  end
end
