class AddCardListLayoutToSettings < ActiveRecord::Migration[8.1]
  # 一覧のカードに何をどの順で出すか。**表示の有無と並び順を1つに持つ。**
  #
  # これまでは「名前に出す項目（card_headline_key）」と
  # 「名前の下に出す項目（card_list_fields）」の2つに分かれていた。
  # 分かれていると、並び替えができず、名前と下の項目の関係も決められない。
  #
  # 形: [{ "key" => "title", "visible" => true }, ...]（順序がそのまま表示順）
  #
  # **旧の2列は消さない。** 既に設定している人の値をここで壊さないため、
  # 空のときだけ旧の値から読み解く（Setting#card_list_layout_entries）。
  # 新しい保存はこちらへ寄せる。旧列の削除は、全員が新形式になってから別途行う。
  def change
    add_column :settings, :card_list_layout, :jsonb, default: [], null: false
  end
end
