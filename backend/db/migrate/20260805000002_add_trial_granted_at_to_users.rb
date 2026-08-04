# frozen_string_literal: true

# 無料のお試し枠を配った時刻。
#
# これまで無料枠は「毎月10枚」を配り続けていた。人が増えるほど、
# 使われなくても配り続けることになり、原価だけが積み上がる。
# また、アカウントを作り直すたびに毎月もらえる状態でもあった。
#
# 1アカウントにつき1回だけにする。配ったかどうかをここで持つ。
class AddTrialGrantedAtToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :trial_granted_at, :datetime
  end
end
