class CreateDecks < ActiveRecord::Migration[8.1]
  def change
    create_table :decks, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.string :name, null: false
      # 表紙に指定したカード（デッキ内のいずれかの item）。任意
      t.uuid :cover_item_id

      t.timestamps
    end

    add_index :decks, :user_id
    add_index :decks, [ :user_id, :created_at ]
    add_foreign_key :decks, :users, on_delete: :cascade
    # 表紙カードが削除されたら表紙指定だけ外す
    add_foreign_key :decks, :items, column: :cover_item_id, on_delete: :nullify
  end
end
