# frozen_string_literal: true

# デッキはビュー(view_type='deck')へ統合済み（Phase B 完了）。旧テーブル・一時カラムを撤去する。
# 本番カットオーバー(decks:cutover)実施後に適用すること。
class DropDeckTables < ActiveRecord::Migration[8.1]
  def up
    # 旧デッキの ActiveStorage 添付(cover_image)を除去。blob は移行時に view と共有済みのため purge しない。
    execute "DELETE FROM active_storage_attachments WHERE record_type = 'Deck'"

    # 参照テーブル → 本体テーブルの順で drop
    drop_table :collection_decks
    drop_table :deck_items
    drop_table :decks

    # 移行用の一時カラム（unique index も同時に外れる）
    remove_column :views, :source_deck_id
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
