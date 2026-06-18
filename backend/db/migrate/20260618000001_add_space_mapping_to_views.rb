class AddSpaceMappingToViews < ActiveRecord::Migration[8.1]
  def change
    # ビュー「スペースマッピング」: 配置先スペースと、各ポイントへのカード配置。
    # スペース削除時はビューを残す（nullify）。ポイント削除時は配置を消す（cascade）。
    add_reference :views, :space, type: :uuid, null: true, index: true,
                  foreign_key: { on_delete: :nullify }
    add_reference :view_items, :space_point, type: :uuid, null: true, index: true,
                  foreign_key: { on_delete: :cascade }

    # space_map では 1 ポイントにつき 1 カード（space_point_id がある行のみ一意）
    add_index :view_items, [ :view_id, :space_point_id ],
              unique: true,
              where: "space_point_id IS NOT NULL",
              name: "index_view_items_on_view_and_space_point"
  end
end
