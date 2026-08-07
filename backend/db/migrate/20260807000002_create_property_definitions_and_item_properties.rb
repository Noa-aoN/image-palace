# frozen_string_literal: true

# カードに好きな項目を持たせるための2枚。
#
# 記憶したいものは分野で変わる。語学なら読み仮名と発音記号、法律なら条文番号、
# 解剖なら部位と神経支配。作り付けの欄を足し続けると際限がないので、
# **項目そのものを利用者が定義できる**ようにする。
#
#   property_definitions … どの項目を持つか（種別ごと）。ラベル・型・並び順
#   item_properties      … その項目の値（カードごと）
#
# 定義を「カードの種別」に紐づけるのは、単語には読み仮名が要るが人物には要らない、
# という食い違いが種別で説明できるため。カードを別の種別へ移せば、持つ項目も変わる。
#
# 値は jsonb 1本にする。型ごとに列を分けると型が増えるたびに移行が要り、
# list（複数値）のような型が列に収まらない。読み書きは必ずモデル経由にする。
class CreatePropertyDefinitionsAndItemProperties < ActiveRecord::Migration[8.0]
  def change
    create_table :property_definitions, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.references :item_type, null: false, foreign_key: true, type: :uuid
      # 機械が使う名前（AI への指示や将来の書き出しで参照する）
      t.string :key, null: false
      # 画面に出す名前。利用者はこちらだけを気にする
      t.string :label, null: false
      t.string :value_type, null: false, default: "text"
      t.text :description
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :property_definitions, [ :user_id, :item_type_id, :key ], unique: true,
              name: "index_property_definitions_on_user_type_key"
    add_index :property_definitions, [ :user_id, :item_type_id, :position ],
              name: "index_property_definitions_on_user_type_position"

    create_table :item_properties, id: :uuid do |t|
      t.references :item, null: false, foreign_key: true, type: :uuid
      t.references :property_definition, null: false, foreign_key: true, type: :uuid
      # 型ごとの中身は value["v"] に入れる（スカラーも配列もここ1本で扱う）
      t.jsonb :value, null: false, default: {}
      t.timestamps
    end
    add_index :item_properties, [ :item_id, :property_definition_id ], unique: true,
              name: "index_item_properties_on_item_and_definition"
  end
end
