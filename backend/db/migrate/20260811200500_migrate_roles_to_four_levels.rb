class MigrateRolesToFourLevels < ActiveRecord::Migration[8.1]
  # 役割を2段階（user / admin / owner）から4段階（user / support / operator / admin）へ。
  #
  # **誰の権限も上げ下げしない。** 名前だけを付け替える。
  #   owner → admin    … どちらも最上位。名前を admin に統一する
  #   admin → operator … いまの admin は「閲覧・コンテンツ管理」で、operator の中身と同じ
  #   user  → user     … そのまま
  #
  # 順番が要る。先に owner→admin をやると、元の admin と見分けが付かなくなる。
  # **必ず admin→operator を先に済ませてから、owner→admin へ移す。**
  def up
    execute "UPDATE users SET role = 'operator' WHERE role = 'admin'"
    execute "UPDATE users SET role = 'admin' WHERE role = 'owner'"
  end

  def down
    execute "UPDATE users SET role = 'owner' WHERE role = 'admin'"
    execute "UPDATE users SET role = 'admin' WHERE role = 'operator'"
    # support には戻す先が無い。降ろすと権限を失うので、閲覧のできる admin として残す
    execute "UPDATE users SET role = 'admin' WHERE role = 'support'"
  end
end
