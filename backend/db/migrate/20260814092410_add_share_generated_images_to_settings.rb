class AddShareGeneratedImagesToSettings < ActiveRecord::Migration[8.0]
  def change
    # 自分が作らせた絵を、ほかの人にも使わせてよいか。
    #
    # 同じ指示の絵は世界で1回しか作らない仕組みなので、既定では
    # 誰かが作った絵が、同じ指示を書いた次の人にもそのまま渡る。
    # ふつうは得しかない（待ち時間ゼロ・原価ゼロ）が、
    # **自分の言葉で書いた指示は、自分だけのものにしておきたい**こともある。
    #
    # 切っても、ほかの人が作った絵は今までどおり使える。
    # 切るのは「出す側」だけ。取る側まで切ると、待ち時間も原価も跳ね上がるうえ、
    # 得るものが無い（同じ絵がもう1枚できるだけ）。
    add_column :settings, :share_generated_images, :boolean, default: true, null: false
  end
end
