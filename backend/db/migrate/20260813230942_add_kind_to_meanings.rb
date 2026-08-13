class AddKindToMeanings < ActiveRecord::Migration[8.0]
  def change
    # 「意味」と一括りにしていたものを、何を書いた文かで分ける。
    #
    #   meaning     … その語が指すもの。いちばん短い
    #   description … かみ砕いた説明
    #   commentary  … 背景や周辺の話。長くなる
    #   translation … 他の言語での言い方
    #   origin      … もとの意味（原義）。いまの意味とずれていることがある
    #
    # 分けないと、短く覚えたい人にも長い解説が出る。
    # 逆に、原義だけ知りたいのに いまの意味しか無い、も起きる。
    add_column :meanings, :kind, :string, default: "meaning", null: false
    add_index :meanings, [ :item_id, :kind ]
  end
end
