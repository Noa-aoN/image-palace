class AddFactCheckSuggestionToMeanings < ActiveRecord::Migration[8.1]
  def change
    # ファクトチェックで doubtful / incorrect のときの訂正案（説明文の書き換え候補）。
    add_column :meanings, :fact_check_suggestion, :text
  end
end
