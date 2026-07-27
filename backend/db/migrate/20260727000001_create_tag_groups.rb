# frozen_string_literal: true

class CreateTagGroups < ActiveRecord::Migration[8.1]
  def change
    # タグのグループ（タイトルのあるタグの集まり）。ユーザーごとに保持。
    # 科学分類/NDC などのプリセットは default_key で識別し、seed を冪等にする。
    # 1タグが複数グループに属せる多対多のため、実体は tag_group_items で表現する。
    create_table :tag_groups, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :position
      t.boolean :pinned, default: false, null: false
      t.boolean :is_default, default: false, null: false
      t.string :default_key # "science" / "ndc"。プリセット識別用。ユーザー作成は nil
      t.timestamps
    end

    add_index :tag_groups, [ :user_id, :name ], unique: true
    # プリセットはユーザーごとに1つ（冪等 seed 用）。nil は一意制約の対象外にする。
    add_index :tag_groups, [ :user_id, :default_key ], unique: true,
              where: "default_key IS NOT NULL", name: "index_tag_groups_on_user_id_and_default_key"

    create_table :tag_group_items, id: :uuid do |t|
      t.references :tag_group, type: :uuid, null: false, foreign_key: true
      t.references :tag, type: :uuid, null: false, foreign_key: true
      t.integer :position
      t.timestamps
    end

    add_index :tag_group_items, [ :tag_group_id, :tag_id ], unique: true
  end
end
