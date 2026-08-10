class AddCardPropertyPresetsToSettings < ActiveRecord::Migration[8.1]
  # カードが持つ項目の「ひな型」。
  #
  # これまで、どの項目を出すかはカード1枚ずつ決めるしかなく、
  # 100枚作れば100回同じ操作をすることになっていた。
  #
  # 形は [{ "name" => "単語用", "keys" => ["meanings", "examples", "prop:reading"] }]。
  # 種別ごとではなく利用者ごとに持つ。種別に縛ると「単語だが人物寄り」の
  # ような中間のカードで選べなくなる。
  def change
    add_column :settings, :card_property_presets, :jsonb, default: [], null: false
    # 新しいカードに最初から当てるひな型の名前。空なら当てない
    add_column :settings, :default_card_preset, :string
  end
end
