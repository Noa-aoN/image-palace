class DropRooms < ActiveRecord::Migration[8.1]
  # スペースの種別化により Room を廃止（Space に統合）。未リリースのためデータ破棄。
  def up
    drop_table :room_collections
    drop_table :rooms
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
