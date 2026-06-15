class AddCoverTypeToDecks < ActiveRecord::Migration[8.1]
  def change
    # first_card（既定・先頭カードをホバーで切替） / collage（4枚コラージュ） / custom（アップロード画像）
    add_column :decks, :cover_type, :string, default: "first_card", null: false
  end
end
