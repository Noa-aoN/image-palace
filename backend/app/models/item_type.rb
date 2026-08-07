class ItemType < ApplicationRecord
  has_many :property_definitions, dependent: :destroy
  has_many :items, dependent: :destroy
end
