# frozen_string_literal: true

# 管理操作の記録。
#
# 権限の付け外しやユーザーへの操作は、後から「誰がいつ何をしたか」を辿れないと
# 事故のときに何も分からない。将来チームが増えたり、運営を引き継いだりする場面では
# なおさら要る。追記のみで、書き換えも削除もしない。
class CreateAdminAuditLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :admin_audit_logs, id: :uuid do |t|
      # 操作した人。退会しても記録は残す（nullify）
      t.references :actor, type: :uuid, foreign_key: { to_table: :users, on_delete: :nullify }, index: false
      # 記録時点の識別。actor が消えても誰だったか分かるように残す
      t.string :actor_email
      t.string :action, null: false
      t.string :target_type
      t.uuid :target_id
      t.jsonb :details, null: false, default: {}
      t.datetime :created_at, null: false
    end

    add_index :admin_audit_logs, :created_at
    add_index :admin_audit_logs, [ :actor_id, :created_at ]
  end
end
