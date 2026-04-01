class RefactorSharedMediasForCacheDesign < ActiveRecord::Migration[8.1]
  def up
    add_column :shared_medias, :normalized_prompt, :string, null: false, default: ""
    add_index :shared_medias, :normalized_prompt

    remove_foreign_key :shared_medias, :users
    change_column_null :shared_medias, :user_id, true
    add_foreign_key :shared_medias, :users, on_delete: :nullify

    remove_column :shared_medias, :url, :text
  end

  def down
    add_column :shared_medias, :url, :text
    remove_foreign_key :shared_medias, :users
    change_column_null :shared_medias, :user_id, false
    add_foreign_key :shared_medias, :users, on_delete: :cascade
    remove_index :shared_medias, :normalized_prompt
    remove_column :shared_medias, :normalized_prompt
  end
end
