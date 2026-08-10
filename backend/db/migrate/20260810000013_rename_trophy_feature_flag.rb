class RenameTrophyFeatureFlag < ActiveRecord::Migration[8.1]
  # ページを「トロフィー」から「アチーブメント」に改名したぶんの引っ越し。
  # 旧キーのまま残ると、画面が知らないキーになって設定が黙って効かなくなる。
  def up
    execute("DELETE FROM feature_flags WHERE key = 'page.trophy' " \
            "AND EXISTS (SELECT 1 FROM feature_flags f2 WHERE f2.key = 'page.achievements')")
    execute("UPDATE feature_flags SET key = 'page.achievements' WHERE key = 'page.trophy'")
  end

  def down
    execute("UPDATE feature_flags SET key = 'page.trophy' WHERE key = 'page.achievements'")
  end
end
