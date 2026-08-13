# frozen_string_literal: true

module Billing
  # クレジットの寿命を決める唯一の場所。
  #
  # 「3ヶ月」を各所に書くと、規約・画面・実装・本番データが少しずつずれる。
  # 長さを変えるときは、ここだけを変えれば全部が動く形にしておく。
  #
  # 期限を置く理由は3つ。
  #   1. 受け取ったのにまだ提供していないぶん（＝これから出ていく原価）を抑える
  #   2. 売上は毎月立つのに、原価は使われた時に出る。離れすぎないようにする
  #   3. 前払式支払手段は、6ヶ月以内に限り使えるものなら規制の適用除外に入りやすい
  # 3 があるので、**6ヶ月を超えないこと**。
  #
  # 正式公開の初期は3ヶ月から始める。恒久固定ではない。
  # この時期は AI の値段・使うモデル・為替・1枚あたりの実原価・消化ペースの
  # どれもが動く。四半期ごとに実績を見て、見通しが立つなら延ばす。
  #
  # **短くするより延ばすほうが説明しやすい**ので、短いところから始める。
  # 延ばすのは「増えた」と受け取られるが、縮めるのは既に配ったものを取り上げる話になる。
  #
  # 出どころで分けない。無料も有料も、受け取りから同じ長さ。
  # 払っている人ほど厳しい、という逆転を作らないため。
  module CreditExpiryPolicy
    LIFETIME = 3.months

    # 月額プランのぶんは、まず subscription_credits に1ヶ月居てから持ち越しへ移る。
    # 移す先の寿命を1ヶ月短くすると、届いた日から数えてちょうど LIFETIME ぶん使える。
    CARRYOVER_LIFETIME = LIFETIME - 1.month

    # 受け取った時刻から数えた期限
    def self.expires_at(from = Time.current)
      from + LIFETIME
    end

    # 月額の使い残しを持ち越すときの期限
    def self.carryover_expires_at(from = Time.current)
      from + CARRYOVER_LIFETIME
    end

    # 画面・API に出す「◯ヶ月」
    def self.months
      (LIFETIME / 1.month).to_i
    end
  end
end
