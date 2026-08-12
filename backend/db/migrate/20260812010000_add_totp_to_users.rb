class AddTotpToUsers < ActiveRecord::Migration[8.1]
  # 二要素認証（TOTP）。
  #
  # totp_secret は暗号化して持つ（`encrypts` を使う）。生のまま置くと、
  # DB が漏れた時点で二要素が二要素でなくなる。列は text にする。
  # 暗号化すると元より長くなるので、string の既定長では入らないことがある。
  #
  # totp_confirmed_at は「設定を終えたか」の印。秘密鍵を作っただけでは
  # 有効にしない。認証アプリに登録し、実際にコードが合うところまで確かめてから
  # 立てる。ここを分けないと、登録に失敗した人が締め出される。
  #
  # totp_recovery_codes は復旧コードのハッシュ。端末を失うと詰むので必ず配る。
  # 生のまま持たない（漏れたら二要素を回避できてしまう）。使い捨て。
  def change
    add_column :users, :totp_secret, :text
    add_column :users, :totp_confirmed_at, :datetime
    add_column :users, :totp_recovery_codes, :jsonb, default: [], null: false

    # 危ない操作の前に、もう一度本人か確かめた時刻。
    # API なのでセッションが無く、ここに持つ
    add_column :users, :reauthenticated_at, :datetime
  end
end
