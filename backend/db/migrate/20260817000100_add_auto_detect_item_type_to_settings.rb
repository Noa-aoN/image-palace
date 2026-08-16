class AddAutoDetectItemTypeToSettings < ActiveRecord::Migration[8.0]
  # 種別を AI に決めさせるかどうか。
  #
  # 既定は入り。何も選ばずに作ると、これまでは全部が「単語」で溜まっていた。
  # 種別は持てる項目（読み仮名・式・生没年…）を決めるので、
  # 全部が単語だと、人物にも出来事にも語の項目が並ぶことになる。
  #
  # 意味・タグの自動生成と同じ並びに置く（切りたい人は同じ場所で切れる）。
  def change
    add_column :settings, :auto_detect_item_type, :boolean, default: true, null: false
  end
end
