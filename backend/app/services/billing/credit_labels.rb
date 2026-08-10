# frozen_string_literal: true

module Billing
  # クレジットの出どころの表示名。
  #
  # 残高も履歴も同じ言葉で出したいので、1か所にまとめる。
  # ここがずれると「履歴では『お試し』なのに残高では『ボーナス』」のような食い違いが起きる。
  module CreditLabels
    LABELS = {
      "trial" => "お試し",
      "monthly_free" => "毎月の無料枠",
      "topup" => "買い切り",
      "topup_legacy" => "買い切り（期限なし）",
      "subscription" => "プランの当月分",
      "subscription_carryover" => "プランの持ち越し",
      "free_carryover" => "無料枠の引き継ぎ",
      "campaign" => "キャンペーン",
      "goodwill" => "お詫び・調整"
    }.freeze

    module_function

    def for(kind)
      LABELS[kind.to_s] || kind.to_s
    end
  end
end
