class CreateRoads < ActiveRecord::Migration[8.1]
  def change
    create_table :roads, id: :uuid do |t|
      t.uuid :space_id, null: false
      t.string :name, null: false
      t.integer :position

      t.timestamps
    end

    add_index :roads, :space_id
    add_index :roads, [ :space_id, :position ]
    add_foreign_key :roads, :spaces, on_delete: :cascade
  end
end
