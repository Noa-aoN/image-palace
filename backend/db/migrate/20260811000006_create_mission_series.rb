class CreateMissionSeries < ActiveRecord::Migration[8.1]
  def change
    # ミッションのシリーズ。「複数の段を、順に開けていく1本の道」。
    #
    # 単発のミッションだけだと、続けるほど「もう取るものが無い」に近づく。
    # シリーズは、先があることを見せながら、**いま挑む1段だけ**を渡すための入れ物。
    create_table :mission_series, id: :uuid do |t|
      t.string :key, null: false
      t.string :name, null: false
      t.text :description
      t.integer :position, null: false, default: 0
      t.boolean :enabled, null: false, default: true
      t.boolean :published, null: false, default: true
      t.timestamps
    end
    add_index :mission_series, :key, unique: true

    change_table :mission_definitions, bulk: true do |t|
      # null なら単発のミッション（これまでどおり）
      t.references :mission_series, type: :uuid, foreign_key: true, index: true
      # シリーズ内の段。1 から順に開く
      t.integer :series_step, null: false, default: 0
    end
  end
end
