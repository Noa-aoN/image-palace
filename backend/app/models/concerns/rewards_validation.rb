# frozen_string_literal: true

# 報酬（獲得物・クレジット）を持つ定義に共通の検証。
#
# 実績とミッションで同じ検証が要る。**片方にしか付けないと、付いていない側が
# 抜け道になる。** 実際、クレジットの決まり（Achievements::RewardPolicy）は
# 組み込みの定義でしか守られておらず、運営が画面から作る行には効いていなかった。
# ミッションには報酬の検証が1つも無く、存在しない獲得物も指せた。
#
# 組み込みの定義は `update_columns` で書き戻すのでここを通らない（コードが正本）。
# ここが守るのは**画面から作られる行**。
module RewardsValidation
  extend ActiveSupport::Concern

  included do
    validate :rewards_must_be_known
    validate :rewards_must_follow_policy
  end

  private

  # 存在しない獲得物を指したまま保存できると、達成しても何も配られない
  def rewards_must_be_known
    Array(rewards).each do |reward|
      type = reward["type"]
      case type
      when "reward"
        next if RewardDefinition.exists?(key: reward["key"])

        errors.add(:rewards, "に無い獲得物が入っています（#{reward["key"]}）")
      when "credits"
        next if reward["amount"].to_i.positive?

        errors.add(:rewards, "のクレジットは1以上にしてください")
      else
        errors.add(:rewards, "に知らない種類が入っています（#{type}）")
      end
    end
  end

  # クレジットを返してよい条件か、量が上限内かを見る。
  # 判断は Achievements::RewardPolicy に置き、ここでは呼ぶだけ
  def rewards_must_follow_policy
    Achievements::RewardPolicy.violations([ self ]).each do |violation|
      errors.add(:rewards, violation.sub(/\A#{Regexp.escape(key.to_s)}: /, ""))
    end
  end
end
