# frozen_string_literal: true

module Billing
  # 引き換えコードを受け取る。
  #
  # 断る理由は利用者に伝わる言葉で返す。「無効です」だけだと、打ち間違いなのか
  # 期限切れなのか、既に受け取っているのかが分からず、問い合わせになる。
  #
  # ただし**存在しないコードと使えないコードは区別しない**。
  # 区別すると、総当たりで「実在するコード」を探し当てられてしまう。
  #
  # 無料枠のブレーカー（FreeGrantGuard）は通さない。あれは自動で配るぶんの見張りで、
  # ここに混ぜると大きめのキャンペーンが新規登録のお試し枠を食い潰す。
  # 配りすぎはコードごとの人数上限で止める。
  class RedeemCampaignCode
    class Error < StandardError; end
    # 打ち間違い・期限切れ・上限到達をまとめて返す（実在の有無を漏らさない）
    class Unavailable < Error; end
    class AlreadyRedeemed < Error; end

    UNAVAILABLE_MESSAGE = "このコードは使えません。入力を確かめてください。"
    ALREADY_MESSAGE = "このコードは受け取り済みです。"

    # 何を受け取ったか。**クレジットと荷物で、返すものが違う**
    Result = Struct.new(:credits, :label, :expires_at, :package, :items, keyword_init: true)

    def self.call(...)
      new(...).call
    end

    def initialize(user:, code:, now: Time.current)
      @user = user
      @raw = code
      @now = now
    end

    def call
      code = CampaignCode.lookup(@raw)
      raise Unavailable, UNAVAILABLE_MESSAGE if code.nil? || !code.available?(@now)
      raise AlreadyRedeemed, ALREADY_MESSAGE if code.redemptions.exists?(user_id: @user.id)
      return grant_package!(code) if code.package?

      grant!(code)
    end

    private

    # 荷物を配る。**配る仕組みはデルフォイと同じものを通す。**
    #
    # 入口が違うだけで、やることは同じ（同じカードを2枚にしない・
    # 由来を残す・二重に受け取らせない）。ここで別に書くと必ずずれる。
    #
    # **無料枠は使わない。** コードは配る側が数を決めているので、
    # 受け取る側の無料枠を食う理由が無い（`campaign` は `FREE_SOURCES` に無い）
    def grant_package!(code)
      package = code.package
      raise Unavailable, UNAVAILABLE_MESSAGE if package.nil?

      result = nil
      ActiveRecord::Base.transaction do
        code.with_lock do
          raise Unavailable, UNAVAILABLE_MESSAGE unless code.available?(@now)

          code.redemptions.create!(user: @user, points: 0, created_at: @now)
        end
        result = ContentPackages::Distributor.call(user: @user, package: package, source: "campaign")
      end

      Result.new(credits: 0, label: code.label, expires_at: nil,
                 package: package.name, items: result.imported.items_by_local_key.size)
    rescue ActiveRecord::RecordNotUnique
      raise AlreadyRedeemed, ALREADY_MESSAGE
    rescue ContentPackages::Distributor::AlreadyInstalled
      # **もう持っている。** コードは使わせない（使ったことにすると、
      # 持っているのに受け取れないまま1回分が消える）
      raise AlreadyRedeemed, "この公式コンテンツは、すでに受け取っています。"
    end

    def grant!(code)
      points = code.points
      expires_at = code.credit_expires_at(@now)

      ActiveRecord::Base.transaction do
        # 総数の上限は行ロックの中で数える。外で数えると、同時に押されたぶんが上限を超える
        code.with_lock do
          # 使い切りだけでなく **期限・開始・有効/無効も、ロックの中でもう一度見る**。
          # 外の判定から書き込みまでの間に期限が切れることがあるし、
          # 運営が止めた直後に押されたぶんも、ここで止まる
          raise Unavailable, UNAVAILABLE_MESSAGE unless code.available?(@now)

          code.redemptions.create!(user: @user, points: points, created_at: @now)
        end
        @user.grant_credits!(points, kind: "campaign", expires_at: expires_at,
                                     metadata: { "campaign_code" => code.code })
      end

      Result.new(credits: points.fdiv(POINTS_PER_CREDIT), label: code.label, expires_at: expires_at)
    rescue ActiveRecord::RecordNotUnique
      # 同じ人が同時に2回押した場合。DB の一意制約が正
      raise AlreadyRedeemed, ALREADY_MESSAGE
    end
  end
end
