class CreateStrongAuthSessions < ActiveRecord::Migration[8.1]
  # 強い確認を通ったのは「その人」ではなく「**いま使っているこの端末**」。
  #
  # 利用者の列に一つ持たせると、机のパソコンで確かめた結果が、
  # 置き忘れた携帯にも効いてしまう。端末ごとに分けて持つ。
  #
  # 端末の見分けには devise-token-auth の client を使う。
  # トークンそのものは毎リクエストで作り直されるが、**client は変わらない**ので、
  # トークンの中に書くと消える（そちらに持たせてはいけない）。
  #
  # ログアウトすると client ごと消えるので、この行も掃除の対象になる。
  def change
    create_table :strong_auth_sessions, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :client_id, null: false
      t.datetime :authenticated_at, null: false
      # どの方法で確かめたか。危険操作の判定には使わない（監査のため）
      t.string :method
      t.timestamps

      # 端末ごとに1行。同じ端末で確かめ直したら上書きする
      t.index [ :user_id, :client_id ], unique: true
      # 期限切れの掃除で使う
      t.index :authenticated_at
    end
  end
end
