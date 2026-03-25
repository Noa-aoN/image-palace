# NOTE:
# meanings は将来的に item + relation へ統合予定
# MVPでは単純化のため分離テーブルとして扱う
class CreateMeanings < ActiveRecord::Migration[8.1]
  def change
    create_table :meanings, id: :uuid do |t|
      t.uuid :item_id, null: false
      t.text :definition, null: false
      t.text :example_sentence
      t.string :language_code, null: false, default: "ja"

      t.timestamps
    end

    add_index :meanings, :item_id
    add_foreign_key :meanings, :items, on_delete: :cascade
  end
end
