class AddFactCheckToMeanings < ActiveRecord::Migration[8.1]
  def change
    # 説明（meaning）のAIファクトチェック結果。status は correct/doubtful/incorrect、
    # comment は意義・疑問・質問などの自由文。
    add_column :meanings, :fact_check_status, :string
    add_column :meanings, :fact_check_comment, :text
    add_column :meanings, :fact_checked_at, :datetime
  end
end
