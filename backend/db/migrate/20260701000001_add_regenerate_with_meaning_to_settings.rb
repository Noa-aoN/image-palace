class AddRegenerateWithMeaningToSettings < ActiveRecord::Migration[8.1]
  def change
    # 再生成時に「意味・説明を参考にする」の既定値（既定 ON）。
    add_column :settings, :regenerate_with_meaning, :boolean, null: false, default: true
  end
end
