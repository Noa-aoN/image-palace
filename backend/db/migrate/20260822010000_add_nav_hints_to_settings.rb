# frozen_string_literal: true

# サイドバーやアイコンに、指を乗せたときの説明を出すかどうか。
#
# **慣れた人には邪魔になる。** 場所を覚えてしまえば、動くたびに説明が出るのは
# 目障りでしかない。一方、はじめの数日はこれが無いと何の場所か分からない。
#
# 既定は「出す」。分からない人のほうが困り方が大きいため。
# 体験の宮殿では**必ず出す**（初めて触る人しか居ない）。
class AddNavHintsToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :nav_hints, :boolean, default: true, null: false
  end
end
