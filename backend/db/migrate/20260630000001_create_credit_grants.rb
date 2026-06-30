class CreateCreditGrants < ActiveRecord::Migration[8.1]
  def change
    create_table :credit_grants, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true, index: false
      t.string :kind, null: false                 # free_carryover / campaign / goodwill ...
      t.integer :amount_points, null: false        # 付与時の総量（ポイント）
      t.integer :remaining_points, null: false     # 残量（消費で減る）
      t.datetime :expires_at                        # null=期限なし
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end
    # 有効グラントの抽出・期限順消費に使う
    add_index :credit_grants, [ :user_id, :expires_at ]
  end
end
