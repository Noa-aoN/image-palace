class MakeMediaUrlNullable < ActiveRecord::Migration[8.1]
  def change
    change_column_null :medias, :url, true
  end
end
