class AddNameAndGenerationToSpacePoints < ActiveRecord::Migration[8.1]
  def change
    # ポイント名（loci の手掛かり語）と、その名前から生成する画像の生成ステータス・メタデータ。
    # items と同型の生成パイプラインを踏襲する。画像本体は ActiveStorage で添付する。
    add_column :space_points, :name, :string
    add_column :space_points, :generation_status, :string, null: false, default: "pending"
    add_column :space_points, :metadata, :jsonb, null: false, default: {}
  end
end
