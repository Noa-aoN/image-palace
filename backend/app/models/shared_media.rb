class SharedMedia < ApplicationRecord
  self.table_name = 'shared_medias'

  belongs_to :user
end
