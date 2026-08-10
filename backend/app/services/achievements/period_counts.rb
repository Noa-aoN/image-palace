# frozen_string_literal: true

module Achievements
  # 「その期間に入ってからいくつか」を数える。
  #
  # 今日ぶん・今週ぶんのミッションを通算の数で判定すると、
  # 既に条件を満たしている人は初日に全部達成してしまう。
  # 期間で絞れる種類だけをここに持ち、絞れないものは通算に落とす
  # （落とすほうを既定にすると、増やしたときに黙って間違うため明示する）。
  module PeriodCounts
    module_function

    COUNTERS = {
      "cards_created" => ->(user, since) { user.items.where(created_at: since..).count },
      "images_generated" => lambda { |user, since|
        ImageUsage.where(user_id: user.id, created_at: since..).count
      },
      "containers_created" => lambda { |user, since|
        user.boxes.where(created_at: since..).count +
          user.views.where(created_at: since..).count +
          user.spaces.where(created_at: since..).count
      },
      "reviews_total" => lambda { |user, since|
        ItemReview.where(user_id: user.id, reviewed_at: since..).count
      },
      "reviews_correct" => lambda { |user, since|
        ItemReview.where(user_id: user.id, result: "correct", reviewed_at: since..).count
      }
    }.freeze

    # 期間で絞れないもの（続いている日数など）は通算のまま。
    # 「今週7日続ける」のような条件は、期間で切っても意味が変わらない
    def value_for(type, user, since)
      counter = COUNTERS[type.to_s]
      return Conditions.value_for(type, user) if counter.nil?

      counter.call(user, since).to_i
    end
  end
end
