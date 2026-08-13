class DropLegacyCardListFieldsFromSettings < ActiveRecord::Migration[8.1]
  # 一覧の表示設定を `card_list_layout` に一本化したので、古い2つを落とす。
  #
  # ## なぜ落としてよいか
  #
  # 本番の実データで、**旧フィールドを使っている人が0人**であることを確かめた（#598）。
  #   - 3名は旧設定も空で、読み解き結果が既定（title / image）と一致
  #   - 1名は既に新形式で保存済み（旧値は読まれていない）
  #
  # アプリ側の参照は先に落とし、**本番で新形式だけで動くことを確かめてから**ここに来ている。
  # 同じデプロイで消すと、入れ替わりの瞬間に古いコードが消えた列を読む余地が残る。
  #
  # ## 戻し方
  #
  # `down` で列は戻るが、**中身は戻らない**（消した値は残っていない）。
  # 戻したところで、読む側のコードはもう無い。列だけが空で復活する。
  def up
    remove_column :settings, :card_headline_key
    remove_column :settings, :card_list_fields
  end

  def down
    add_column :settings, :card_headline_key, :string
    add_column :settings, :card_list_fields, :jsonb, default: [], null: false
  end
end
