# frozen_string_literal: true

# 公式制作枠を、何にいくら使ったか。
#
# **通常のクレジットとは別に数える。** 買った残高を減らさないので、
# `credit_transactions` には載らない。だが「いくら使ったか」は要る。
#
# 原価そのものは `image_usages` / `ai_usages` が持っているので、
# ここが持つのは**枠をどれだけ使ったか**だけ。
class CreateStudioUsages < ActiveRecord::Migration[8.1]
  def change
    create_table :studio_usages, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      # 何に使ったか（image / meaning / tags など）
      t.string :kind, null: false
      t.integer :cost_points, null: false
      # どのカードのためか。**消えても記録は残す**（使った事実は動かない）
      t.references :item, null: true, foreign_key: { on_delete: :nullify }, type: :uuid

      t.datetime :created_at, null: false
    end

    # 今月ぶんを数える
    add_index :studio_usages, [ :user_id, :created_at ]
  end
end
