class AddImageKeyToPlans < ActiveRecord::Migration[8.1]
  # プランの徽章。獲得物と同じ流儀で、鍵だけを持つ。
  #
  # 添付にしないのは、プランの絵は運営が用意する固定の素材で、
  # 環境ごとに作り直す性質のものではないため（獲得物と同じ理由）。
  def change
    add_column :plans, :image_key, :string
  end
end
