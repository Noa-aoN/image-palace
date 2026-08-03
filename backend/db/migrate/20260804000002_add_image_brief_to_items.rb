# frozen_string_literal: true

# カードごとの「説明文」と「情景プロンプト」。
#
# これまでは単語をそのまま画像生成に渡していたため、りんごのような具体物は良くても
# 概念語（例: 機会費用）は絵にしようがなかった。単語を一度ことばで噛み砕いてから
# 絵にすることで、概念語でも人が見て分かる情景になる。
#
# 作った後からユーザーが確認・編集できるよう、生成物をカードに残す。
class AddImageBriefToItems < ActiveRecord::Migration[8.1]
  def change
    change_table :items, bulk: true do |t|
      # ① 単語を調べて書いた説明文（日本語・情報量多め）
      t.text :image_description
      # ② ①から起こした情景プロンプト（英語・画像生成に渡す）
      t.text :scene_prompt
      # none / pending / processing / completed / failed
      t.string :brief_status, null: false, default: "none"
      # ユーザーが手で直した時刻。以後は自動生成で上書きしない
      t.datetime :brief_edited_at
    end
  end
end
