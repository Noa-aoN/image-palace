class User < ApplicationRecord
  has_one :setting, dependent: :destroy
  has_many :items, dependent: :destroy
  has_many :relations, dependent: :destroy
end
