# frozen_string_literal: true

class DefaultGenerationOptionsToTrue < ActiveRecord::Migration[8.1]
  def up
    # カード作成時のタグ生成・説明生成を既定ONにする（新規ユーザー＝既定値、既存＝バックフィル）。
    change_column_default :settings, :auto_generate_tags, from: false, to: true
    change_column_default :settings, :auto_generate_meanings, from: false, to: true
    execute "UPDATE settings SET auto_generate_tags = true, auto_generate_meanings = true"
  end

  def down
    change_column_default :settings, :auto_generate_tags, from: true, to: false
    change_column_default :settings, :auto_generate_meanings, from: true, to: false
  end
end
