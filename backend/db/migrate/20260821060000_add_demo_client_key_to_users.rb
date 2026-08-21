# frozen_string_literal: true

# 体験用の宮殿を、同じ画面から二重に建てさせないための目印。
#
# ## なぜ要るか
#
# 戻るための合鍵（`resume_token`）は、**1回目の返事を受け取ってから**しか持てない。
# だから「初めての1回」がほぼ同時に2本来ると、宮殿が2つ建つ。
# 連打は画面側で塞いであるが、再送・タブ2枚・通信のやり直しでは起こりうる。
#
# ## なぜ IP で見ないか
#
# IP は同じ建物・同じ回線の他人と共有される。
# それを鍵にすると、**他人の宮殿に入れてしまう**。
#
# 画面が自分で作って持つ合言葉にする。合鍵と同じ性格のもので、
# 知っている人だけがその宮殿に入れる。
#
# ## 守り方
#
# 一意索引を張る。**同時に2本来ても、片方は必ず落ちる。**
# 落ちた側は、既に建った宮殿を引き直して返す。
class AddDemoClientKeyToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :demo_client_key, :string

    # 体験用の口座にしか入らないので、部分索引にする
    add_index :users, :demo_client_key, unique: true, where: "demo_client_key IS NOT NULL"
  end
end
