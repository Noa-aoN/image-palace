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
      current_from(dates(user), now)
    end

    # これまででいちばん長く続いた日数
    def longest(user)
      longest_from(dates(user))
    end

    # 学習した日の数（連続でなくてよい）
    def active_days(user)
      dates(user).size
    end

    # 3つまとめて。日付の一覧を1回引くだけで全部出せる。
    #
    # current / longest / active_days をそれぞれ呼ぶと、同じ
    # `DISTINCT DATE(reviewed_at)` を3回引くことになる。DB は片道70ms のところにある
    def summary(user, now = Time.current)
      list = dates(user)
      {
        current: current_from(list, now),
        longest: longest_from(list),
        active_days: list.size
      }
    end

    def current_from(list, now = Time.current)
      return 0 if list.empty?

      today = now.to_date
      cursor = list.first
      return 0 if cursor < today - 1

      list.each_with_index.take_while { |date, index| date == cursor - index }.size
    end

    def longest_from(list)
      ascending = list.reverse
      return 0 if ascending.empty?

      best = 1
      run = 1
      ascending.each_cons(2) do |a, b|
        run = b == a + 1 ? run + 1 : 1
        best = [ best, run ].max
      end
      best
    end
  end
end
