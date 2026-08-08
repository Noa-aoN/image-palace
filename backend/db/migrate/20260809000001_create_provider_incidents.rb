class CreateProviderIncidents < ActiveRecord::Migration[8.1]
  # 供給側（OpenAI 等）の停止を残す。
  #
  # クォータ枯渇はユーザーの再試行では復旧せず、運営者が残高を補充するまで続く。
  # これまでログの warn しか残らず、運営者が気づく手段が無かった。
  #
  # Rails.cache では代わりにならない。app と worker は別マシンで、
  # 既定の file_store はマシンごとに分かれるため、worker が検知した事象を
  # 管理画面（app 側）から読めない。
  def change
    create_table :provider_incidents, id: :uuid do |t|
      t.string :provider, null: false
      t.string :kind, null: false
      t.string :code
      t.text :message
      # 同じ事象が続く間は1行にまとめ、件数だけ増やす（一括生成で行が溢れないように）
      t.integer :occurrences, null: false, default: 1
      t.datetime :first_occurred_at, null: false
      t.datetime :last_occurred_at, null: false

      t.timestamps
    end

    add_index :provider_incidents, [ :provider, :kind, :last_occurred_at ]
  end
end
