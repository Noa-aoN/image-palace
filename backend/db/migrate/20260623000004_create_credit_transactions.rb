# frozen_string_literal: true

class CreateCreditTransactions < ActiveRecord::Migration[8.1]
  def change
    create_table :credit_transactions, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: { on_delete: :cascade }

      # kind: subscription_grant / subscription_expire / topup_purchase /
      #       consumption / refund / adjustment
      t.string :kind, null: false
      # 残高の増減（消費は負）
      t.integer :delta, null: false
      # 記録時点の残高スナップショット（監査用）
      t.integer :subscription_credits_after
      t.integer :topup_credits_after

      # 関連（任意）
      t.uuid :item_id
      t.uuid :space_point_id
      t.uuid :subscription_id
      # Stripe イベント由来の冪等キー（webhook 重複防止）
      t.string :stripe_event_id

      t.string :description

      t.timestamps
    end

    add_index :credit_transactions, [ :user_id, :created_at ]
    add_index :credit_transactions, :stripe_event_id, unique: true, where: "stripe_event_id IS NOT NULL"
  end
end
