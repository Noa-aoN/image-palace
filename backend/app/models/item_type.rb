class ItemType < ApplicationRecord
  # 何も選ばれなかったときの種別。**名前を散らかさない**
  # （作成・自動判定の両方が「既定かどうか」を見るため）
  DEFAULT_NAME = "term"

  has_many :property_definitions, dependent: :destroy
  has_many :items, dependent: :destroy
end
