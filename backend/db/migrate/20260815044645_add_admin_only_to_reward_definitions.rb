class AddAdminOnlyToRewardDefinitions < ActiveRecord::Migration[8.1]
  # 運営だけに見せる獲得物（執政官など）。
  # 既定は false。**null を許すと「見せてよいか分からない行」ができる**ので許さない
  def change
    add_column :reward_definitions, :admin_only, :boolean, default: false, null: false
  end
end
