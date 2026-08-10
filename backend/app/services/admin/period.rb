# frozen_string_literal: true

module Admin
  # 運営画面で見る期間。
  #
  # 「直近30日」だけに固定していると、始めたばかりの週の動きも、四半期の傾きも、
  # 締めた月の実績も読めない。かといってページごとに別の選び方を置くと、
  # 同じ「6月」を見ているつもりで違う範囲を見ることになる。
  #
  # 選び方は3種類だけに絞る。
  #   直近◯日 … いまの調子を見る（7 / 30 / 90）
  #   ◯年◯月 … 締めた月の実績を見る（収支と同じ切り方）
  #   長い範囲 … 半年・1年・全期間で傾きを見る
  #
  # 収支ページが先に「対象の月」を持っていたので、月の指定はそちらに合わせる。
  class Period
    # 直近◯日。値は日数
    ROLLING = { "7d" => 7, "30d" => 30, "90d" => 90, "6m" => 182, "1y" => 365 }.freeze
    ALL = "all"
    DEFAULT = "30d"
    # 月の指定（2026-07 の形）
    MONTH_FORMAT = /\A(\d{4})-(\d{1,2})\z/

    # 折れ線に出す点の数の上限。これを超える期間はまとめて出す
    # （1年ぶんを1日1点で描くと、点が細かすぎて傾きが読めない）
    MAX_SERIES_POINTS = 45

    attr_reader :key, :from, :to, :label

    def self.resolve(value, now: Time.current)
      new(value, now)
    end

    # 画面に出す選択肢。月の一覧は、いちばん古い記録から今月まで
    def self.options(now: Time.current)
      {
        rolling: [
          { value: "7d", label: "直近7日" },
          { value: "30d", label: "直近30日" },
          { value: "90d", label: "直近90日" },
          { value: "6m", label: "直近半年" },
          { value: "1y", label: "直近1年" }
        ],
        months: available_months(now: now),
        all: { value: ALL, label: "全期間" }
      }
    end

    def self.available_months(now: Time.current)
      first = [ User.minimum(:created_at), CreditTransaction.minimum(:created_at) ].compact.min
      return [] if first.nil?

      months = []
      cursor = first.in_time_zone.beginning_of_month
      last = now.beginning_of_month
      while cursor <= last
        months << { value: format("%04d-%02d", cursor.year, cursor.month), label: "#{cursor.year}年#{cursor.month}月" }
        cursor = cursor.next_month
      end
      months.reverse
    end

    def initialize(value, now)
      @now = now
      @key = normalize(value)
      @from, @to, @label = resolve_range
    end

    # 直近◯日か（画面のラベルで「30日の消費」のように使う）
    def rolling?
      ROLLING.key?(@key)
    end

    def days
      ((@to - @from) / 1.day).round
    end

    # 折れ線の1点にまとめる日数。長い期間ほど大きくなる
    def bucket_days
      [ (days.to_f / MAX_SERIES_POINTS).ceil, 1 ].max
    end

    def to_h
      { key: @key, label: @label, from: @from, to: @to, days: days }
    end

    private

    def normalize(value)
      key = value.to_s.strip
      return key if ROLLING.key?(key) || key == ALL || key.match?(MONTH_FORMAT)

      DEFAULT
    end

    def resolve_range
      if (days = ROLLING[@key])
        [ @now - days.days, @now, rolling_label(days) ]
      elsif @key == ALL
        [ first_record_at, @now, "全期間" ]
      else
        month_range
      end
    end

    def rolling_label(days)
      case @key
      when "6m" then "直近半年"
      when "1y" then "直近1年"
      else "直近#{days}日"
      end
    end

    def month_range
      year, month = @key.match(MONTH_FORMAT).captures.map(&:to_i)
      from = Time.zone.local(year, month, 1)
      [ from, from.next_month, "#{year}年#{month}月" ]
    end

    # いちばん古い記録。何も無ければ1年前まで遡る（範囲が空だと割り算が崩れる）
    def first_record_at
      [ User.minimum(:created_at), Item.minimum(:created_at) ].compact.min&.in_time_zone || @now - 1.year
    end
  end
end
