class ChangeRegenerateWithMeaningDefaultToFalse < ActiveRecord::Migration[8.1]
  def up
    # 既定を OFF に変更。導入直後のトグルで true は「列の既定値」由来＝意図的選択ではないため、
    # 既存の true 行も false に揃える（既定変更を現行ユーザーにも反映する）。
    change_column_default :settings, :regenerate_with_meaning, from: true, to: false
    execute "UPDATE settings SET regenerate_with_meaning = false WHERE regenerate_with_meaning = true"
  end

  def down
    change_column_default :settings, :regenerate_with_meaning, from: false, to: true
  end
end
