# frozen_string_literal: true

# キャンバスの状態の控え。AI 調整を戻せるようにするために持つ。
#
# AI に任せた結果が思ったものと違ったとき、手で元に戻すのは現実的でない
# （配置も線もまとめて変わるため）。調整の前後を控えておいて、行き来できるようにする。
#
# 控えるのは配置と線だけ。カードそのものは消していないので、状態を戻せば元に戻る。
class CreateViewRevisions < ActiveRecord::Migration[8.1]
  def change
    create_table :view_revisions, id: :uuid do |t|
      t.references :view, type: :uuid, null: false, foreign_key: { on_delete: :cascade }, index: false
      # 1 から始まる連番。views.revision_cursor がいまどこを見ているかを指す
      t.integer :position, null: false
      # { "items": [...], "edges": [...] }
      t.jsonb :state, null: false, default: {}
      # 「AI調整の前」「AI調整の後」など、何をした時点かの目印
      t.string :label
      t.datetime :created_at, null: false
    end

    add_index :view_revisions, [ :view_id, :position ], unique: true

    # いま何番目の控えを見ているか。0 は控えがまだ無い状態
    add_column :views, :revision_cursor, :integer, null: false, default: 0
  end
end
