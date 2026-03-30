class FixActiveStorageAttachmentsRecordIdForUuid < ActiveRecord::Migration[8.1]
  def change
    # medias テーブルは UUID primary key のため record_id を string に変更する
    change_column :active_storage_attachments, :record_id, :string, null: false
  end
end
