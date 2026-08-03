# frozen_string_literal: true

class AddListingIndexToBoxEntries < ActiveRecord::Migration[8.1]
  # ボックスの中身は「box_id で絞って新しい順」で読む（一覧・詳細のページングとも）。
  # box_id だけの索引では並べ替えが残るため、並び順まで含めた索引を足す。
  # 既存の index_box_entries_on_box_id はこの索引で代替できるので落とす。
  def change
    add_index :box_entries,
              [ :box_id, :created_at, :id ],
              order: { created_at: :desc, id: :desc },
              name: "index_box_entries_on_box_and_recency"

    remove_index :box_entries, column: :box_id, name: "index_box_entries_on_box_id"
  end
end
