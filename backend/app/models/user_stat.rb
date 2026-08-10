# frozen_string_literal: true

# 記録（積み上がった数字）。
#
# **これはキャッシュであって真実ではない。** 元データからいつでも数え直せる。
# 保存しているのは毎回数えると遅いからで、記録そのものをここに宿すためではない。
# ずれたら消して作り直してよい。
class UserStat < ApplicationRecord
  belongs_to :user

  COUNTERS = %w[
    cards_created images_generated containers_created
    reviews_total reviews_correct
    streak_days longest_streak active_days
    rewards_earned achievements_completed
  ].freeze

  LABELS = {
    "cards_created" => "作ったカード",
    "images_generated" => "作った画像",
    "containers_created" => "作ったまとまり",
    "reviews_total" => "見返した回数",
    "reviews_correct" => "正解した回数",
    "streak_days" => "続いている日数",
    "longest_streak" => "最長の連続日数",
    "active_days" => "学習した日数",
    "rewards_earned" => "獲得したもの",
    "achievements_completed" => "達成した実績"
  }.freeze

  UNITS = {
    "cards_created" => "枚", "images_generated" => "枚", "containers_created" => "個",
    "reviews_total" => "回", "reviews_correct" => "回",
    "streak_days" => "日", "longest_streak" => "日", "active_days" => "日",
    "rewards_earned" => "個", "achievements_completed" => "件"
  }.freeze

  # 数え直して書き戻す
  def self.recompute!(user)
    stat = find_or_initialize_by(user: user)
    stat.assign_attributes(
      cards_created: Achievements::Conditions.value_for("cards_created", user),
      images_generated: Achievements::Conditions.value_for("images_generated", user),
      containers_created: Achievements::Conditions.value_for("containers_created", user),
      reviews_total: Achievements::Conditions.value_for("reviews_total", user),
      reviews_correct: Achievements::Conditions.value_for("reviews_correct", user),
      streak_days: Achievements::Streak.current(user),
      longest_streak: Achievements::Streak.longest(user),
      active_days: Achievements::Streak.active_days(user),
      rewards_earned: UserReward.where(user_id: user.id).count,
      achievements_completed: UserAchievement.where(user_id: user.id).completed.count,
      computed_at: Time.current
    )
    stat.save!
    stat
  end

  def to_rows
    COUNTERS.map { |key| { key: key, label: LABELS[key], unit: UNITS[key], value: self[key] } }
  end
end
