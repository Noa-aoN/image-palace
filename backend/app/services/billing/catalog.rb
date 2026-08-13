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
    # 画像1枚あたりの原価の見立て。
    #
    # 実費は8円を超えており、円安の影響で今後も上がりうる。
    # 上振れしてから慌てて値上げすると利用者に不信を与えるので、
    # はじめから安全側（9円）で置き、そこから利益が残る値段にしておく。
    COST_PER_CREDIT = 9.0
    # 決済手数料（日本のカード）。粗利はこれを引いてから見る
    STRIPE_FEE_RATE = 0.036
    # クレジットの寿命は Billing::CreditExpiryPolicy が持つ（1か所に集約）。

    # 無料枠。ここは「回収の当てがない支出」なので、絞れるだけ絞る。
    #
    # 登録1件あたりの持ち出しは TRIAL_CREDITS × 原価。
    # 1万件登録されたら、それがそのまま出ていく。10枚だと60万円になり、
    # 課金の見込みが立たないうちは負えない額になる。
    #
    # 3枚は「カードが何であるか分かる」最小限。足りないと感じたら上げられるが、
    # 上げるほど、課金に至らなかった人ぶんの損がそのまま増える。
    TRIAL_CREDITS = 3

    # 毎月の無料枠。訪れた人にだけ配る（来ない人には配られない）ので、
    # 使われている実感と釣り合う。1枚なら1人あたり月6円で、戻ってくる理由にもなる。
    MONTHLY_FREE_CREDITS = 1

    # 上限まで使われても残したい粗利率。下回る価格は置かない。
    #
    # 25% にしているのは、原価の見立て（9円）そのものに既に余裕を持たせているから。
    #   粗利 25% ＝ 手数料後の受取が 1 枚あたり 12 円以上
    #   実費が 11 円まで上がっても黒字が保てる（実費は現在 8 円台）
    # 見立てを 6 円にしていた頃は 35% にしていた。原価側で余裕を見た分、ここは下げてよい。
    #
    # ここを価格に合わせて下げないこと。合わせて下げた時点で、この検査は何も守らなくなる。
    MIN_MARGIN = 0.25

    # 月額プラン。
    #
    # 付与枚数は「価格 ÷ 枚数」が原価を十分上回るように決める。
    # 値上げではなく付与枚数で調整しているのは、価格を変えると Stripe の Price を
    # 作り直すことになり、既存の契約者にも影響が及ぶため。
    SUBSCRIPTIONS = [
      # free は「契約なし」を表す枠。毎月の付与は行わない（お試しは TRIAL_CREDITS を1回だけ）
      { name: "free",     tier: "free",     price: 0,      credits: 0 },
      { name: "standard", tier: "standard", price: 1_480,  credits: 100 },
      { name: "pro",      tier: "pro",      price: 3_980,  credits: 280 },
      { name: "creator",  tier: "creator",  price: 9_800,  credits: 720 },
      { name: "studio",   tier: "studio",   price: 19_800, credits: 1_550 }
    ].freeze

    # 買い切り（Top-up）。まとまるほど1枚あたりを安くする。
    TOPUPS = [
      { name: "topup_10",   price: 190,    credits: 10 },
      { name: "topup_50",   price: 900,    credits: 50 },
      { name: "topup_100",  price: 1_700,  credits: 100 },
      { name: "topup_300",  price: 4_800,  credits: 300 },
      { name: "topup_1000", price: 15_000, credits: 1_000 }
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
