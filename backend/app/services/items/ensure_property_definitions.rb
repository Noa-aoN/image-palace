# frozen_string_literal: true

module Items
  # 「読み仮名も一緒に作って」と言われたときに、**その項目の定義が無ければ作る**。
  #
  # 項目は種別ごとに利用者が決めるものだが、決めていない人がほとんどだった
  # （本番で定義を持っていたのは13人中1人）。定義が無いと、作成時に埋めようとしても
  # 埋める先が無く、**何も起きないのに何も言われない**という状態になる。
  #
  # 出したいと決めた時点で、決めたぶんだけ用意する。
  # 名前と型はフロントの候補（PROPERTY_PRESETS）と揃える。ここでずれると、
  # 同じ「読み仮名」が人によって別の識別名で作られる。
  class EnsurePropertyDefinitions
    # 作成時に選べるもの。ここに無い識別名は作らない（勝手に項目を増やさない）。
    PRESETS = {
      "reading" => { label: "読み仮名", value_type: "text", description: "その語の読み。複数の読みがあれば全部。" },
      "aliases" => { label: "別名・異表記", value_type: "list", description: "同じものを指す別の呼び名や書き方。" },
      "pronunciation" => { label: "発音記号", value_type: "text", description: "発音記号（IPA など）。" }
    }.freeze

    KEYS = PRESETS.keys.freeze

    def self.call(...)
      new(...).call
    end

    def initialize(user:, item_type_id:, keys:)
      @user = user
      @item_type_id = item_type_id
      @keys = Array(keys).map(&:to_s) & KEYS
    end

    # 用意できた識別名を返す。既にあるものはそのまま使う（作り直さない）
    def call
      return [] if @keys.empty? || @item_type_id.blank?

      existing = @user.property_definitions.for_item_type(@item_type_id).where(key: @keys).pluck(:key)
      (@keys - existing).each { |key| create!(key) }
      @user.property_definitions.for_item_type(@item_type_id).where(key: @keys).pluck(:key)
    end

    private

    def create!(key)
      attrs = PRESETS.fetch(key)
      @user.property_definitions.create!(
        item_type_id: @item_type_id, key: key,
        label: attrs[:label], value_type: attrs[:value_type], description: attrs[:description]
      )
    rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
      # 同時に2枚作ったときに両方が作ろうとすることがある。片方が勝てばよい
      Rails.logger.info "[EnsurePropertyDefinitions] skipped key=#{key}: #{e.class}"
    end
  end
end
