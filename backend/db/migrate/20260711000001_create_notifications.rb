class CreateNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :notifications, id: :uuid do |t|
      t.uuid :user_id, null: false
      # 通知の種別（item_generation_completed / item_generation_failed / announcement）
      t.string :kind, null: false
      t.string :title, null: false
      t.text :body
      # クリック時の遷移先（フロントの相対パス。例: /items/<id>）
      t.string :url
      # 種別ごとの付随情報（item_id・まとめ件数 count など）
      t.jsonb :payload, null: false, default: {}
      # 既読日時。NULL なら未読
      t.datetime :read_at

      t.timestamps
    end

    add_index :notifications, [ :user_id, :created_at ]
    add_index :notifications, [ :user_id, :read_at ]
    add_foreign_key :notifications, :users, on_delete: :cascade
  end
end
