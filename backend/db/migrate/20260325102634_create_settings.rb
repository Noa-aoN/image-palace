class CreateSettings < ActiveRecord::Migration[8.1]
  def change
    create_table :settings, id: false do |t|
      t.uuid :user_id, primary_key: true, null: false
      t.string :locale, null: false, default: "ja"
      t.string :timezone, null: false, default: "Asia/Tokyo"

      t.timestamps
    end
    add_foreign_key :settings, :users, on_delete: :cascade
  end
end
