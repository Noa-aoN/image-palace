class User < ApplicationRecord
  has_one :setting, dependent: :destroy
end
