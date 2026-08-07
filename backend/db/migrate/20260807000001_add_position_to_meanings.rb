# frozen_string_literal: true

# 意味・説明を1枚のカードに複数持てるようにするための並び順。
#
# これまで UI は「代表の1件」しか出しておらず、順番を気にする必要が無かった。
# 複数を並べるなら、どれが最初に来るかが毎回同じでないと読む側が困る。
# medias が既に position を持っているので、同じ持ち方に揃える。
#
# 既存行は作成順で埋める（それまで画面に出ていた順序と食い違わせない）。
class AddPositionToMeanings < ActiveRecord::Migration[8.0]
  def up
    add_column :meanings, :position, :integer
    add_index :meanings, [ :item_id, :position ]

    execute <<~SQL.squish
      UPDATE meanings SET position = ordered.row_number - 1
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY created_at, id) AS row_number
        FROM meanings
      ) AS ordered
      WHERE meanings.id = ordered.id
    SQL
  end

  def down
    remove_index :meanings, [ :item_id, :position ]
    remove_column :meanings, :position
  end
end
