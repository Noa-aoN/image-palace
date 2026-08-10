class AddCardListFieldsToSettings < ActiveRecord::Migration[8.1]
  # 一覧のカードに、名前と絵のほかに出す項目。
  #
  # 数を絞る。100枚の格子に何行も並べると、一覧としては読めなくなる。
  # 上限はモデル側（Setting::MAX_CARD_LIST_FIELDS）で持つ。
  def change
    add_column :settings, :card_list_fields, :jsonb, default: [], null: false
  end
end
