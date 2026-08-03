# frozen_string_literal: true

# カバー画像を AI で作れるようにするための生成状態。
#
# カバーはこれまで「先頭カード / コラージュ / 自分でアップロード」の3択で、
# 中身がまだ無いものには見せられる絵が無かった。プロフィールアイコンと同じように
# ことばから作れるようにする。
#
# 生成は非同期なので、アバターと同じく状態と失敗理由を持たせる。
class AddCoverGenerationToCoveredRecords < ActiveRecord::Migration[8.1]
  TABLES = %i[views spaces boxes].freeze

  def change
    TABLES.each do |table|
      change_table table, bulk: true do |t|
        # nil / pending / processing / completed / failed
        t.string :cover_generation_status
        t.text :cover_generation_error
      end
    end
  end
end
