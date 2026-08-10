# frozen_string_literal: true

# 実績とミッションを数え直す。
#
# 主要な操作（カード作成・画像生成・学習の記録）のあとに1本だけ積む。
# 評価は冪等なので、重なって走っても二重に配られることはない。
#
# 落ちても本来の処理は取り消さない。実績が遅れて付くのは困らないが、
# 実績のせいでカードが作れないのは困る。
class EvaluateAchievementsJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find_by(id: user_id)
    return unless user

    Achievements::Evaluator.call(user: user)
  rescue StandardError => e
    Rails.logger.warn "[EvaluateAchievementsJob] failed user_id=#{user_id} #{e.class}: #{e.message}"
  end
end
