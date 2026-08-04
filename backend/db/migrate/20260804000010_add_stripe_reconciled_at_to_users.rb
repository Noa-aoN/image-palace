# frozen_string_literal: true

# 最後に Stripe と突き合わせた時刻。
#
# webhook が届かない・遅れる・落ちるといったことは必ず起きる。
# そのたびに「払ったのに増えない」を人手で直すのは、運営として成り立たない。
#
# 残高を見にきたときに、しばらく突き合わせていなければその場で確認する。
# 毎回 Stripe を叩くと遅く高くつくので、最後に確認した時刻を持って間隔を空ける。
class AddStripeReconciledAtToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :stripe_reconciled_at, :datetime
  end
end
