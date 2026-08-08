class CreateImageUsages < ActiveRecord::Migration[8.1]
  # 画像生成の実回数を残す。文章側の ai_usages と対になるもの。
  #
  # これまで実回数を数えられるのは shared_medias（カード画像・キャッシュミス時のみ）だけで、
  # アバター・カバー・スペースのポイント画像は記録が無く、原価の概算が過少になっていた。
  # 呼び出しは ImageGenerators::Base に集約されているので、そこで1行残す。
  def change
    create_table :image_usages, id: :uuid do |t|
      # どの機能からの生成か（item / avatar / cover / point）
      t.string :kind, null: false
      t.string :provider, null: false
      t.string :model, null: false
      t.string :size
      t.string :quality
      t.uuid :user_id

      t.datetime :created_at, null: false
    end

    add_index :image_usages, :created_at
    add_index :image_usages, [ :model, :created_at ]
    add_index :image_usages, :user_id
  end
end
