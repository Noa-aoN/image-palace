# frozen_string_literal: true

module Achievements
  # 何に対してクレジットを返してよいか。
  #
  # 実績とミッションの条件は、大きく2つに分かれる。
  #
  #   払って届くもの … カードを作る・絵を生成する（1枚 = 1クレジット）
  #   払わず届くもの … 見返す・続ける・訪れる・まとめる・獲得物を集める
  #
  # **クレジットは前者にしか出さない。** 後者から出すと、原価の裏付けが無いまま
  # 人数ぶんの持ち出しになる。1人あたりは小さくても、利用者が万の桁に乗れば
  # そのまま万倍で効く（1人 100cr なら、1万人で 900 万円）。
  #
  # 前者に出すぶんは「返し」であって配布ではない。1000枚作った人は 1000cr を
  # 払っているので、10cr を返しても比率は 1%。人数が増えても、増えたぶんだけ
  # 先に受け取っている。
  module RewardPolicy
    # クレジットを消費しないと満たせない条件。ここだけがクレジットを返してよい
    CREDIT_BACKED_CONDITIONS = %w[cards_created images_generated].freeze

    # 返してよい上限（消費に対する比率）。1000枚に 10cr で 1%
    MAX_REFUND_RATE = 0.01

    module_function

    # その条件は、クレジットを使わないと届かないか
    def credit_backed?(condition_type)
      CREDIT_BACKED_CONDITIONS.include?(condition_type.to_s)
    end

    # 定義1件がクレジットで配る量（cr）
    def credit_amount(definition)
      Array(definition.rewards).sum do |reward|
        reward["type"] == "credits" ? reward["amount"].to_i : 0
      end
    end

    # 配ってよい上限。払わずに届く条件なら 0
    def max_credits_for(definition)
      return 0 unless credit_backed?(definition.condition_type)

      (definition.condition_target * MAX_REFUND_RATE).floor
    end

    # 決まりに反している定義（条件と量の両方を見る）
    def violations(definitions)
      definitions.filter_map do |definition|
        amount = credit_amount(definition)
        next if amount.zero?

        limit = max_credits_for(definition)
        next if amount <= limit

        reason =
          if credit_backed?(definition.condition_type)
            "#{amount}cr は上限 #{limit}cr を超えています"
          else
            "#{definition.condition_type} はクレジットを使わずに満たせるので、クレジットは配れません"
          end
        "#{definition.key}: #{reason}"
      end
    end
  end
end
