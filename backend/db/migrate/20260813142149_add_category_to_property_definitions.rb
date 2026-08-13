class AddCategoryToPropertyDefinitions < ActiveRecord::Migration[8.0]
  def change
    # 項目の役割。**何のために持つのか**で分ける。
    #
    #   subject   … 見出し語そのものについて（読み・語源・品詞…）
    #   mnemonic  … 覚えるための手立て（語呂合わせ・変換イメージ…）
    #   admin     … 整理のため（出典・メモ・注意点…）
    #
    # 分けないと、覚えるための手立てと、調べた事実が同じ見た目で並ぶ。
    # 「語源」と「語呂合わせ」は隣に置くと似て見えるが、
    # 前者は**合っているか**が大事で、後者は**思い出せるか**が大事。
    add_column :property_definitions, :category, :string, default: "subject", null: false
    add_index :property_definitions, [ :user_id, :item_type_id, :category ],
              name: "index_property_definitions_on_user_type_category"
  end
end
