class AddRarityLevelToRewardDefinitions < ActiveRecord::Migration[8.1]
  # レア度を9段階の数値で持つ。九柱のムーサに対応させるため。
  #
  # 文字列（common/uncommon/rare/legendary）は消す。
  # 段階と文字列の2つを持つと、必ずどちらかが古くなる。
  BACKFILL = { "common" => 2, "uncommon" => 4, "rare" => 6, "legendary" => 8 }.freeze

  def up
    add_column :reward_definitions, :rarity_level, :integer, null: false, default: 2

    BACKFILL.each do |name, level|
      execute("UPDATE reward_definitions SET rarity_level = #{level} WHERE rarity = #{quote(name)}")
    end

    remove_column :reward_definitions, :rarity
  end

  def down
    add_column :reward_definitions, :rarity, :string, null: false, default: "common"
    BACKFILL.each do |name, level|
      execute("UPDATE reward_definitions SET rarity = #{quote(name)} WHERE rarity_level = #{level}")
    end
    remove_column :reward_definitions, :rarity_level
  end

  private

  def quote(value)
    ActiveRecord::Base.connection.quote(value)
  end
end
