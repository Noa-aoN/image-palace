# frozen_string_literal: true

class AddSurfaceAndUvToSpacePoints < ActiveRecord::Migration[8.1]
  def up
    # 多面ルーム（記憶の宮殿）用: 点が属する面と、その面内の正規化座標 (u,v)∈[0,1]。
    # 既存の x/y（無制限 px の間取り配置）は当面残し、UI 移行後に別マイグレーションで撤去する。
    add_column :space_points, :surface, :string, default: "floor", null: false
    add_column :space_points, :u, :float, default: 0.5, null: false
    add_column :space_points, :v, :float, default: 0.5, null: false

    # 既存 room 点を床面へ移行: x/y の外接矩形で 0..1 に正規化する
    # （現行の俯瞰描画 WalkthroughRoom と同じ bounding-box 正規化なので見た目は不変）。
    # 単一点・スパン0のスペースは中央(0.5,0.5)。
    say_with_time "backfilling space_points u/v from x/y" do
      execute <<~SQL.squish
        WITH bounds AS (
          SELECT space_id,
                 MIN(x) AS min_x, MAX(x) AS max_x,
                 MIN(y) AS min_y, MAX(y) AS max_y
          FROM space_points
          GROUP BY space_id
        )
        UPDATE space_points sp
        SET surface = 'floor',
            u = CASE WHEN b.max_x - b.min_x > 0 THEN (sp.x - b.min_x) / (b.max_x - b.min_x) ELSE 0.5 END,
            v = CASE WHEN b.max_y - b.min_y > 0 THEN (sp.y - b.min_y) / (b.max_y - b.min_y) ELSE 0.5 END
        FROM bounds b
        WHERE sp.space_id = b.space_id
      SQL
    end
  end

  def down
    remove_column :space_points, :surface
    remove_column :space_points, :u
    remove_column :space_points, :v
  end
end
