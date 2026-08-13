class AddQuantityToUserRewards < ActiveRecord::Migration[8.1]
  # 同じ宝物を複数持てるようにする。
  #
  # **行は増やさない。** 1人1定義1行のまま（unique index はそのまま）で、
  # 数量を列に持つ。行を増やす形にすると、飾る・掲げるといった状態
  # （equipped / featured_at / room_placed）をどの行が持つのかが決められなくなる。
  #
  # 取得の履歴は user_reward_grants（別の migration）が持つ。
  # ここは「いま何個持っているか」を、数え直さずに読めるようにするためのもの。
  def up
    add_column :user_rewards, :quantity, :integer, default: 1, null: false
    add_column :user_rewards, :first_acquired_at, :datetime
    add_column :user_rewards, :last_acquired_at, :datetime

    # 既にある行は1個持ち。取得時刻は granted_at をそのまま初回・最終に置く
    execute <<~SQL.squish
      UPDATE user_rewards
      SET quantity = 1,
          first_acquired_at = granted_at,
          last_acquired_at = granted_at
      WHERE first_acquired_at IS NULL
    SQL

    # 数量は必ず1以上。0 や負の数が入ると「持っていないのに行がある」状態になり、
    # 画面と DB のどちらが正しいのか決められなくなる
    add_check_constraint :user_rewards, "quantity >= 1", name: "user_rewards_quantity_positive"
  end

  def down
    remove_check_constraint :user_rewards, name: "user_rewards_quantity_positive"
    remove_column :user_rewards, :quantity
    remove_column :user_rewards, :first_acquired_at
    remove_column :user_rewards, :last_acquired_at
  end
end
