class RebalanceRewardRarity < ActiveRecord::Migration[8.1]
  # レア度を「到達の遠さ」に合わせ直す。
  #
  # 最初は文字列（common/uncommon/rare/legendary）から機械的に移したため、
  # カード100枚で最上位の段が出るなど、序盤で高い段を配る形になっていた。
  # 年単位・重課金の到達点に渡すものが無くなるので、上を空けておく。
  #
  # 組み込みの取り込み（ensure_builtins!）は既にある行を触らない設計なので、
  # 段の直しはここで一度だけ当てる。運営が画面で変えた値を上書きしないよう、
  # **移行前の既定と同じ値のものだけ**を直す。
  BEFORE_AND_AFTER = {
    "title_traveler" => [ 2, 1 ], "title_apprentice" => [ 2, 2 ],
    "title_collector" => [ 4, 3 ], "title_visual_thinker" => [ 6, 4 ],
    "medal_first_card" => [ 2, 1 ], "medal_creation_flame" => [ 4, 2 ],
    "medal_streak_star" => [ 4, 3 ], "medal_laurel" => [ 8, 5 ],
    "treasure_seed" => [ 2, 1 ], "treasure_tablet" => [ 2, 2 ],
    "treasure_cup" => [ 4, 2 ], "treasure_book" => [ 4, 3 ],
    "treasure_laurel_pot" => [ 6, 4 ], "treasure_shelf" => [ 4, 3 ],
    "honor_beta" => [ 6, 6 ], "honor_supporter" => [ 8, 7 ], "honor_featured" => [ 8, 7 ]
  }.freeze

  def up
    BEFORE_AND_AFTER.each do |key, (before, after)|
      next if before == after

      execute(
        "UPDATE reward_definitions SET rarity_level = #{after} " \
        "WHERE key = #{quote(key)} AND rarity_level = #{before}"
      )
    end
  end

  def down
    BEFORE_AND_AFTER.each do |key, (before, after)|
      next if before == after

      execute(
        "UPDATE reward_definitions SET rarity_level = #{before} " \
        "WHERE key = #{quote(key)} AND rarity_level = #{after}"
      )
    end
  end

  private

  def quote(value)
    ActiveRecord::Base.connection.quote(value)
  end
end
