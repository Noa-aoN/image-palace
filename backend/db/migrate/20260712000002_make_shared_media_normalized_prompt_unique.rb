class MakeSharedMediaNormalizedPromptUnique < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    deduplicate_shared_medias!

    remove_index :shared_medias,
      name: "index_shared_medias_on_normalized_prompt",
      if_exists: true,
      algorithm: :concurrently

    add_index :shared_medias, :normalized_prompt,
      unique: true,
      name: "index_shared_medias_on_normalized_prompt",
      algorithm: :concurrently,
      if_not_exists: true
  end

  def down
    remove_index :shared_medias,
      name: "index_shared_medias_on_normalized_prompt",
      if_exists: true,
      algorithm: :concurrently

    add_index :shared_medias, :normalized_prompt,
      name: "index_shared_medias_on_normalized_prompt",
      algorithm: :concurrently,
      if_not_exists: true
  end

  private

  def deduplicate_shared_medias!
    execute <<~SQL.squish
      CREATE TEMP TABLE duplicate_shared_media_ids AS
      WITH ranked AS (
        SELECT
          shared_medias.id,
          ROW_NUMBER() OVER (
            PARTITION BY shared_medias.normalized_prompt
            ORDER BY
              CASE WHEN EXISTS (
                SELECT 1
                FROM active_storage_attachments
                WHERE active_storage_attachments.record_type = 'SharedMedia'
                  AND active_storage_attachments.record_id = shared_medias.id::text
                  AND active_storage_attachments.name = 'file'
              ) THEN 0 ELSE 1 END,
              shared_medias.created_at DESC,
              shared_medias.id DESC
          ) AS row_number
        FROM shared_medias
      )
      SELECT id
      FROM ranked
      WHERE row_number > 1
    SQL

    execute <<~SQL.squish
      DELETE FROM active_storage_attachments
      WHERE record_type = 'SharedMedia'
        AND record_id IN (SELECT id::text FROM duplicate_shared_media_ids)
    SQL

    execute <<~SQL.squish
      DELETE FROM shared_medias
      WHERE id IN (SELECT id FROM duplicate_shared_media_ids)
    SQL

    execute "DROP TABLE duplicate_shared_media_ids"
  end
end
