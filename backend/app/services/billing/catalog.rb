# frozen_string_literal: true

module Billing
  # 売り物の一覧（月額プランと買い切り）。
  #
  # これまで seeds.rb に直接書いていたため、価格の妥当性を機械的に確かめられなかった。
  # 「上位ほど安い」「原価を割らない」といった、崩れると気づかないまま損をする性質は、
  # 定義を1か所に置いてテストで守る。
  #
  # 金額は円（JPY はゼロ小数通貨なので price_cents に円をそのまま入れる）。
  module Catalog
    # 画像1枚あたりの原価の見立て。実測は 4〜6 円なので、安全側（高い方）で見る。
    # これを割ると、使われるほど損をする。
    COST_PER_CREDIT = 6.0
    # 決済手数料（日本のカード）。粗利はこれを引いてから見る
    STRIPE_FEE_RATE = 0.036
    # 上限まで使われても残したい粗利率。下回る価格は置かない。
    #
    # 35% にしているのは、原価が見立ての 6 円から 7 円台まで上がっても黒字を保てる水準だから。
    #   粗利 35% ＝ 手数料後の受取が 1 枚あたり 9.2 円以上
    #   原価が 7 円に上がっても粗利 24% は残る
    # ここを価格に合わせて下げないこと。合わせて下げた時点で、この検査は何も守らなくなる。
    MIN_MARGIN = 0.35

    # 月額プラン。
    #
    # 付与枚数は「価格 ÷ 枚数」が原価を十分上回るように決める。
    # 以前は上位ほど1枚あたりが安すぎ、studio は使い切られると逆ざやだった
    # （¥19,800 / 4,000枚 = ¥4.95/枚 に対し原価 ¥6）。
    # 価格は据え置き、付与枚数を実態に合わせて下げた。
    SUBSCRIPTIONS = [
      { name: "free",     tier: "free",     price: 0,      credits: 10 },
      { name: "standard", tier: "standard", price: 1_480,  credits: 100 },
      { name: "pro",      tier: "pro",      price: 3_980,  credits: 300 },
      { name: "creator",  tier: "creator",  price: 9_800,  credits: 800 },
      { name: "studio",   tier: "studio",   price: 19_800, credits: 1_800 }
    ].freeze

    # 買い切り（Top-up）。まとまるほど1枚あたりを安くする。
    TOPUPS = [
      { name: "topup_10",   price: 150,    credits: 10 },
      { name: "topup_50",   price: 650,    credits: 50 },
      { name: "topup_100",  price: 1_200,  credits: 100 },
      { name: "topup_300",  price: 3_300,  credits: 300 },
      { name: "topup_1000", price: 10_000, credits: 1_000 }
    ].freeze

    module_function

    # seeds から使う形（Plan の属性）に整えて返す
    def plans
      subscription_rows + topup_rows
    end

    def subscription_rows
      SUBSCRIPTIONS.map do |row|
        {
          name: row[:name], tier: row[:tier], kind: "subscription", interval: "month",
          price_cents: row[:price], credits_per_period: row[:credits]
        }
      end
    end

    def topup_rows
      TOPUPS.map do |row|
        {
          name: row[:name], tier: "topup", kind: "one_time", interval: nil,
          price_cents: row[:price], credits_per_period: row[:credits]
        }
      end
    end

    # 1クレジットあたりの価格（円）。無料プランは 0 を返す
    def unit_price(row)
      return 0.0 if row[:credits].to_i <= 0

      row[:price].to_f / row[:credits]
    end

    # 決済手数料を引いたあとの粗利率。原価を割ると負になる
    def margin(row)
      net = unit_price(row) * (1 - STRIPE_FEE_RATE)
      return 0.0 if net.zero?

      (net - COST_PER_CREDIT) / net
    end

    # 有料のもの（無料プランは採算の対象外）
    def paid_rows
      (SUBSCRIPTIONS + TOPUPS).reject { |row| row[:price].to_i.zero? }
    end
  end
end
