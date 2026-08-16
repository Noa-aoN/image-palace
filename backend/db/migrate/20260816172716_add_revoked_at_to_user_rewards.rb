class AddRevokedAtToUserRewards < ActiveRecord::Migration[8.0]
  # 手放したものを、行ごと消さずに残す。
  #
  # これまで獲得物は「配ったら消えない」前提だった。プランに付く位のように、
  # 契約が続くあいだだけ持つものが出てきたので、**持っていない状態**を持てるようにする。
  #
  # 行を消さないのは、いつ初めて手にしたか（first_acquired_at）を残すため。
  # 消して作り直すと、取り直したときに「初めて」が今日になってしまう。
  #
  # subscription 専用にはしない。運営の取り消しなど、ほかにも
  # 「持っていたが今は持っていない」は起こり得る。
  def change
    add_column :user_rewards, :revoked_at, :datetime

    # 「いま持っているもの」を引くのが最も多い。
    # 手放したものは少数なので、null だけを拾う部分索引で足りる
    add_index :user_rewards, [ :user_id, :revoked_at ], where: "revoked_at IS NULL",
              name: "index_user_rewards_held_on_user_id"
  end
end
