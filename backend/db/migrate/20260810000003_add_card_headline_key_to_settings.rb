class AddCardHeadlineKeyToSettings < ActiveRecord::Migration[8.1]
  # カード一覧で名前として出す項目。空なら見出し語（items.title）。
  #
  # 端末ごとの localStorage ではなく設定に置くのは、値の解決にサーバー側の
  # 項目データが要るため（一覧の payload に全項目を積むと重い）。
  def change
    add_column :settings, :card_headline_key, :string
  end
end
