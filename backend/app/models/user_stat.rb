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
  # counts に既に数えたものを渡せる。実績の評価はその直前に同じ数を数えており、
  # 渡さないとここで全部数え直すことになる（DB は片道70ms のところにある）。
  # 渡された鍵だけを使い、足りないぶんはここで数える
  def self.recompute!(user, counts: {}, streak: nil)
    counted = ->(key) { counts.fetch(key) { Achievements::Conditions.value_for(key, user) } }
    streak ||= Achievements::Streak.summary(user)

    stat = find_or_initialize_by(user: user)
    stat.assign_attributes(
      cards_created: counted.call("cards_created"),
      images_generated: counted.call("images_generated"),
      containers_created: counted.call("containers_created"),
      reviews_total: counted.call("reviews_total"),
      reviews_correct: counted.call("reviews_correct"),
      streak_days: streak[:current],
      longest_streak: streak[:longest],
      active_days: streak[:active_days],
      rewards_earned: counted.call("rewards_earned"),
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
