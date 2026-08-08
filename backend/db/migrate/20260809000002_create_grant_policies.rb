class CreateGrantPolicies < ActiveRecord::Migration[8.1]
  # 「何を・いくつ・どの条件で配るか」を運営が画面から変えられるようにする。
  #
  # これまで付与量は Billing::Catalog の定数で、変更するにはデプロイが要った。
  # キャンペーンや配りすぎの調整は即時性が要るので、DB へ出す。
  #
  # 一方、価格と原価の関係（MIN_MARGIN）は崩れると気づかないまま損をするため、
  # 定数とテストで守る方針を維持する。ここに置くのは付与の条件だけ。
  #
  # 行が無いキーは Billing::GrantPolicy::DEFAULTS の値で動く（＝現行の挙動のまま）。
  def change
    create_table :grant_policies, id: :uuid do |t|
      t.string :key, null: false
      t.string :reward_type, null: false, default: "credits"
      t.boolean :enabled, null: false, default: true
      # credits なら付与クレジット数、item なら個数
      t.integer :amount, null: false, default: 0
      # reward_type = item のときの対象（box / space / view / skin など）
      t.string :item_kind
      t.jsonb :conditions, null: false, default: {}
      t.text :notes

      t.timestamps
    end

    add_index :grant_policies, :key, unique: true
  end
end
