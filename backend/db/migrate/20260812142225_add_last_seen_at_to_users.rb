class AddLastSeenAtToUsers < ActiveRecord::Migration[8.1]
  # 「その日、来たかどうか」を残す列。DAU / WAU / MAU の素になる。
  #
  # これまで「動いている人」は Item を作った人でしか数えられず、
  # 見に来ただけの人が抜けていた。**来た人＝Active / 作った人＝Engagement** として分ける。
  #
  # **過去に遡って埋めない。** created_at や items から推測すると、
  # 「その日そのユーザーが来たか」とは別のものを Active と呼ぶことになる。
  # この列が入る前は「未計測」として扱う。
  def change
    add_column :users, :last_seen_at, :datetime
    # 期間で絞って数えるだけなので、この1本で足りる（DAU / WAU / MAU とも同じ形）
    add_index :users, :last_seen_at
  end
end
