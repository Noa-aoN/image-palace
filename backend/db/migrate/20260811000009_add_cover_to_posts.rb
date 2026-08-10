class AddCoverToPosts < ActiveRecord::Migration[8.1]
  def change
    # 読みものの見出し画像。画像そのものは ActiveStorage（has_one_attached :cover_image）に持つ。
    #
    # ここに置くのは「絵を出すか」の指定だけ。
    # 添付があっても一覧では出したくない回（短い連絡など）があるので、分けておく。
    add_column :posts, :cover_visible, :boolean, null: false, default: true
  end
end
