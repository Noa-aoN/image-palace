class CreateUserActivityDays < ActiveRecord::Migration[8.0]
  def change
    # 「誰が、どの日に活動したか」だけを残す。1人1日1行。
    #
    # 来訪の履歴は後から作れない。last_seen_at は「最後に来た日」1点しか持たず、
    # 継続率も推移も遡って復元できない。行を足すだけで、その日から測れるようにする。
    #
    # 残すのはこれだけ。URL も操作の中身も IP も端末も持たない。
    create_table :user_activity_days, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid, index: false
      t.date :on_date, null: false
      t.datetime :created_at, null: false
    end

    # 1人1日1行。2回目以降の書き込みはここで弾く（ON CONFLICT DO NOTHING）
    add_index :user_activity_days, [ :user_id, :on_date ], unique: true
    # 「その日に活動した人数」を日付から数えるため
    add_index :user_activity_days, :on_date
  end
end
