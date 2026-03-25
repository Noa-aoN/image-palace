class CreateSharedMedias < ActiveRecord::Migration[8.1]
  def change
    create_table :shared_medias, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.text :url
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :shared_medias, :user_id
    add_foreign_key :shared_medias, :users, on_delete: :cascade
  end
end
