class AddViewsCountToPosts < ActiveRecord::Migration[8.1]
  # 読まれた回数。書いたものが届いているかを運営が確かめられるようにする。
  #
  # 誰が読んだかは持たない。運営が知りたいのは「この記事は読まれたか」であって
  # 「誰が読んだか」ではなく、後者は持つだけで扱いが重くなる。
  def change
    add_column :posts, :views_count, :integer, default: 0, null: false
  end
end
