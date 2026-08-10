# frozen_string_literal: true

module Achievements
  # 学習した日の数え方。
  #
  # 「続いている日数」は、今日まだ学習していなくても昨日までの連続を残す。
  # その日の分を終える前に 0 に戻ると、続ける気を削ぐ。
  module Streak
    module_function

    def dates(user)
      ItemReview.where(user_id: user.id)
                .distinct
                .pluck(Arel.sql("DATE(reviewed_at)"))
                .map(&:to_date)
                .sort
                .reverse
    end

    # 途切れていない日数
    def current(user, now = Time.current)
      list = dates(user)
      return 0 if list.empty?

      today = now.to_date
      cursor = list.first
      return 0 if cursor < today - 1

      list.each_with_index.take_while { |date, index| date == cursor - index }.size
    end

    # これまででいちばん長く続いた日数
    def longest(user)
      list = dates(user).reverse
      return 0 if list.empty?

      best = 1
      run = 1
      list.each_cons(2) do |a, b|
        run = b == a + 1 ? run + 1 : 1
        best = [ best, run ].max
      end
      best
    end

    # 学習した日の数（連続でなくてよい）
    def active_days(user)
      dates(user).size
    end
  end
end
