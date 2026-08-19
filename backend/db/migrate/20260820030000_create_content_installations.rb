# frozen_string_literal: true

# 誰が、どの公式コンテンツを、どの経路から受け取ったか。
#
# 2つに分ける。
#
#   content_installations         受け取りそのもの（1回の受け取り = 1行）
#   content_installation_entries  その受け取りで生まれた実体（カード・箱・キャンバス）
#
# 実体の側に `official_package_id` のような列を足していく形にはしない。
# 種類が増えるたびに全部の表を触ることになるし、
# **1枚のカードが複数の受け取りから参照される**ことを表せない。
class CreateContentInstallations < ActiveRecord::Migration[8.1]
  def change
    create_table :content_installations, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      # 荷物そのものではなく鍵と版を持つ。**受け取ったあと荷物が消えても履歴は残る**
      t.string :package_key, null: false
      t.integer :package_version, null: false
      # starter_free / demo_signup / delphi / mission / campaign / gift / purchase / admin_grant
      t.string :source, null: false
      t.datetime :installed_at, null: false

      t.timestamps
    end

    # 同じ箱を2回持っても、カードが二重に増えるだけで意味が無い。
    # **経路が違っても同じ**（「ミッションでもう1つ」は別の箱を取ることを指す）
    add_index :content_installations, [ :user_id, :package_key ], unique: true
    # 荷物ごとの配布数を数える
    add_index :content_installations, [ :package_key, :package_version ]

    create_table :content_installation_entries, id: :uuid do |t|
      t.references :content_installation, null: false, foreign_key: true, type: :uuid,
                   index: { name: "index_cie_on_installation" }
      # カード・箱・キャンバス。`box_entries` と同じ持ち方
      t.string :record_type, null: false
      t.uuid :record_id, null: false
      # 荷物の中の席次。どの定義から生まれたか辿るため
      t.string :package_local_key
      # **荷物をまたいで変わらない目印**（カードのみ）。同じカードを2枚にしないために引く
      t.string :origin_key

      t.timestamps
    end

    # 1回の受け取りの中では、同じ実体は1度だけ。
    # **実体そのものは一意にしない** — 1枚のカードが複数の受け取りから参照されるため
    add_index :content_installation_entries,
              [ :content_installation_id, :record_type, :record_id ],
              unique: true, name: "index_cie_uniqueness"
    # 「このカードは公式由来か」「どの荷物から来たか」を引く
    add_index :content_installation_entries, [ :record_type, :record_id ], name: "index_cie_on_record"
  end
end
