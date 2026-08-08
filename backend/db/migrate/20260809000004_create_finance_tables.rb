class CreateFinanceTables < ActiveRecord::Migration[8.1]
  # 支出入の概算に使う値。
  #
  # 単価（OpenAI・為替・インフラ月額）は外の都合で変わるので、デプロイ無しで直せるよう
  # DB に置く。行が無いキーは CostParameter::DEFAULTS の既定で動く。
  #
  # あわせて、月ごとの請求実額を入れられるようにする。概算と実額を並べて
  # 乖離を見られるようにするのが、概算の確度を上げる一番現実的な方法のため。
  def change
    create_table :cost_parameters, id: :uuid do |t|
      t.string :key, null: false
      t.decimal :value, precision: 14, scale: 6, null: false
      t.text :note

      t.timestamps
    end
    add_index :cost_parameters, :key, unique: true

    create_table :monthly_actuals, id: :uuid do |t|
      t.integer :year, null: false
      t.integer :month, null: false
      # 請求書の実額（円）
      t.integer :openai_jpy, null: false, default: 0
      t.integer :infra_jpy, null: false, default: 0
      t.integer :other_jpy, null: false, default: 0
      t.text :note

      t.timestamps
    end
    add_index :monthly_actuals, [ :year, :month ], unique: true
  end
end
