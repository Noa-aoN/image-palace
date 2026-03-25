class ItemType < ApplicationRecord
  has_many :items, dependent: :destroy
end
