class AddImageCheckToItems < ActiveRecord::Migration[8.1]
  # 絵が、その語を思い出す助けになっているか。
  #
  # 説明のファクトチェックとは別に持つ。見ているものが違う（世界の事実ではなく、
  # **語と絵の噛み合い**）ので、同じ列に混ぜると「何が correct なのか」が読めなくなる。
  #
  # 置き場所は items。meanings に置くと、説明が無いカードの絵を見られなくなる。
  def change
    add_column :items, :image_check_status, :string
    add_column :items, :image_check_comment, :text
    add_column :items, :image_checked_at, :datetime
  end
end
