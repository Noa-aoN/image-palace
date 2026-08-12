class AddWebauthn < ActiveRecord::Migration[8.1]
  # Passkey / WebAuthn の土台。
  #
  # このマイグレーションでは**入れ物を作るだけ**。ログインの経路も、
  # 危険操作の扱いも、既存の二要素認証の挙動も変えない。
  def change
    # 認証器に渡す利用者の目印。
    #
    # **内部の利用者IDをそのまま渡さない。** user handle は認証器に保存され、
    # 端末を持つ人や、同じ端末を使う別の人から読めることがある。
    # ここから利用者数や登録順が推し量れる形にしない
    add_column :users, :webauthn_id, :string
    add_index :users, :webauthn_id, unique: true

    # 登録した鍵。**1人が何本でも持てる。**
    # 1本しか登録できないと、その端末を失った時点で入れなくなる
    create_table :webauthn_credentials, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      # 認証器が返す credential ID。どの鍵で署名したかを引くのに使う
      t.string :external_id, null: false
      t.string :public_key, null: false
      # 「MacBook の Touch ID」など。複数持つと、どれがどれか分からなくなる
      t.string :nickname
      # 署名回数。扱いは gem の推奨に従う（独自の判定を足さない）
      t.bigint :sign_count, default: 0, null: false
      t.datetime :last_used_at
      t.timestamps

      t.index :external_id, unique: true
    end

    # challenge。**Rails.cache に置かない。**
    #
    # 本番のキャッシュはマシンのローカルディスク（FileStore）で、他のマシンから
    # 見えない。いま app 機は1台なので動くが、2台に増やした瞬間、
    # challenge を配った機と検証する機が食い違って認証が通らなくなる。
    #
    # 短命で、1回きり。使ったら consumed_at を立てて二度と通さない
    create_table :webauthn_challenges, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      # 認証の入口では、まだ誰か分からないことがある（passkey は端末が選ぶ）
      t.references :user, foreign_key: true, type: :uuid
      t.string :challenge, null: false
      # 何のための challenge か。登録用を認証に使い回されないよう分ける
      t.string :purpose, null: false
      t.datetime :expires_at, null: false
      t.datetime :consumed_at
      t.timestamps

      # 引くのは「この challenge の、この用途」。同時に一意性も担保する
      t.index [ :challenge, :purpose ], unique: true
      # 期限切れの掃除で使う
      t.index :expires_at
    end
  end
end
