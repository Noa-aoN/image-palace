class CreateObjectTypes < ActiveRecord::Migration[8.1]
  def change
    create_table :object_types, id: :uuid do |t|
      t.string :name, null: false
      t.string :label, null: false

      t.timestamps
    end
    add_index :object_types, :name, unique: true
  end
end
