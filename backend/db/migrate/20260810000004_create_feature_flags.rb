class CreateFeatureFlags < ActiveRecord::Migration[8.1]
  # 作りかけの機能を、どこまで見せるかを運営が決められるようにする。
  #
  # これまでは画面ごとに comingSoon をベタ書きしていたため、
  # 「開発中の表示を外す」だけでデプロイが要り、戻すのにもデプロイが要った。
  #
  # 行が無ければモデル側の既定で動く（触ったときだけ行ができる）。
  # GrantPolicy / CostParameter と同じ作法に揃えている。
  def change
    create_table :feature_flags, id: :uuid do |t|
      t.string :key, null: false
      t.string :stage, null: false
      t.text :notes
      t.timestamps
    end
    add_index :feature_flags, :key, unique: true
  end
end
