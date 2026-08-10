class RenameFeatureFlagKeysToPages < ActiveRecord::Migration[8.1]
  # 機能の見せ方をページ単位に組み直したぶんの引っ越し。
  #
  # 旧キーのまま残ると、画面が知らないキーになって設定が黙って効かなくなる。
  # 対応するページがあるものは名前を付け替え、無いものはそのまま残す。
  RENAMES = {
    "trophy" => "page.trophy",
    "study_game" => "page.study_game"
  }.freeze

  def up
    RENAMES.each do |old_key, new_key|
      # 引っ越し先が既にあるなら、旧い行は捨てる（新しいほうが正）
      execute("DELETE FROM feature_flags WHERE key = #{quote(old_key)} " \
              "AND EXISTS (SELECT 1 FROM feature_flags f2 WHERE f2.key = #{quote(new_key)})")
      execute("UPDATE feature_flags SET key = #{quote(new_key)} WHERE key = #{quote(old_key)}")
    end
  end

  def down
    RENAMES.each do |old_key, new_key|
      execute("UPDATE feature_flags SET key = #{quote(old_key)} WHERE key = #{quote(new_key)}")
    end
  end

  private

  def quote(value)
    ActiveRecord::Base.connection.quote(value)
  end
end
