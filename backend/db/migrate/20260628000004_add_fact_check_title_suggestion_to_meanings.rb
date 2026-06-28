class AddFactCheckTitleSuggestionToMeanings < ActiveRecord::Migration[8.1]
  def change
    # ファクトチェックで「単語名」自体を直すべきとき（取り違え・誤記など）の訂正案。
    add_column :meanings, :fact_check_title_suggestion, :string
  end
end
