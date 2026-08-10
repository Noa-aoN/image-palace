# frozen_string_literal: true

module Achievements
  # 実績・メダル・称号を、いまあるデータから数え出す。
  #
  # **テーブルを増やさない。** 実績は「これまでの記録をどう読むか」であって、
  # 新しい事実ではない。保存すると、記録を消したときや数え方を変えたときに
  # 実物と食い違い、直す手立てが無くなる。読むたびに数え直せば必ず一致する。
  #
  # 段階（メダル）を持たせているのは、達成が遠すぎると励みにならないため。
  # 最初の1枚で銅が付き、続けた人だけ金に届く形にしてある。
  #
  # 月桂冠は**全部門で金**を取ったときだけ。誰でも取れるものにすると、
  # いちばん上の印としての意味が無くなる。
  class Calculator
    # メダルの段階。下から順に、達成に要る数を並べる
    MEDALS = %w[bronze silver gold].freeze
    MEDAL_LABELS = { "bronze" => "銅", "silver" => "銀", "gold" => "金" }.freeze

    # 部門の定義。thresholds は [銅, 銀, 金]
    CATEGORIES = [
      { key: "cards", label: "カードを作る", unit: "枚", thresholds: [ 1, 50, 300 ],
        description: "作ったカードの枚数" },
      { key: "reviews", label: "学習する", unit: "回", thresholds: [ 1, 100, 1000 ],
        description: "カードを見返した回数" },
      { key: "streak", label: "続ける", unit: "日", thresholds: [ 3, 14, 60 ],
        description: "学習が途切れていない日数" },
      { key: "correct", label: "覚える", unit: "問", thresholds: [ 10, 200, 2000 ],
        description: "正解した回数" },
      { key: "containers", label: "まとめる", unit: "個", thresholds: [ 1, 10, 50 ],
        description: "作ったボックス・キャンバス・スペースの数" }
    ].freeze

    # 称号。到達した部門の金メダルの数で決まる
    TITLES = [
      { key: "novice", label: "見習い", gold_required: 0 },
      { key: "apprentice", label: "記憶の徒", gold_required: 1 },
      { key: "artisan", label: "記憶術士", gold_required: 3 },
      { key: "laureate", label: "月桂冠", gold_required: CATEGORIES.size }
    ].freeze

    def self.call(user:, now: Time.current)
      new(user, now).call
    end

    def initialize(user, now = Time.current)
      @user = user
      @now = now
    end

    def call
      categories = CATEGORIES.map { |definition| build(definition) }
      golds = categories.count { |row| row[:medal] == "gold" }

      {
        categories: categories,
        medals: MEDALS.to_h { |medal| [ medal, categories.count { |row| row[:medal] == medal } ] },
        titles: titles(golds),
        current_title: titles(golds).select { |t| t[:earned] }.last
      }
    end

    private

    def build(definition)
      value = counts.fetch(definition[:key])
      bronze, silver, gold = definition[:thresholds]
      medal = if value >= gold then "gold"
      elsif value >= silver then "silver"
      elsif value >= bronze then "bronze"
      end

      # 次に届く段階。金まで行ったら次は無い（あると永遠に終わらないように見える）
      next_at = definition[:thresholds].find { |threshold| value < threshold }

      definition.slice(:key, :label, :unit, :description).merge(
        value: value,
        medal: medal,
        medal_label: medal && MEDAL_LABELS[medal],
        thresholds: definition[:thresholds],
        next_at: next_at,
        remaining: next_at && (next_at - value)
      )
    end

    def titles(golds)
      TITLES.map do |title|
        title.merge(earned: golds >= title[:gold_required])
      end
    end

    def counts
      @counts ||= {
        "cards" => @user.items.count,
        "reviews" => reviews.count,
        "streak" => streak_days,
        "correct" => reviews.where(result: "correct").count,
        "containers" => @user.boxes.count + @user.views.count + @user.spaces.count
      }
    end

    def reviews
      @reviews ||= ItemReview.where(user_id: @user.id)
    end

    # 途切れていない日数。今日まだ学習していない場合は、昨日までの連続を数える
    # （その日の分を終える前に 0 に戻ると、続ける気を削ぐ）。
    def streak_days
      dates = reviews.distinct.pluck(Arel.sql("DATE(reviewed_at)")).map(&:to_date).sort.reverse
      return 0 if dates.empty?

      today = @now.to_date
      cursor = dates.first
      return 0 if cursor < today - 1

      dates.each_with_index.take_while { |date, index| date == cursor - index }.size
    end
  end
end
