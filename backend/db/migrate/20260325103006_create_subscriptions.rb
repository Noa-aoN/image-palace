class CreateSubscriptions < ActiveRecord::Migration[8.1]
  def change
    create_table :subscriptions, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.uuid :plan_id, null: false
      t.string :status
      t.datetime :started_at, null: false
      t.datetime :current_period_end
      t.timestamps
    end

    add_index :subscriptions, :user_id
    add_index :subscriptions, :plan_id
    add_foreign_key :subscriptions, :users, on_delete: :cascade
    add_foreign_key :subscriptions, :plans, on_delete: :restrict
  end
end
