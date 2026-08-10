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

    Result = Struct.new(:credits, :label, :expires_at, keyword_init: true)

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

      grant!(code)
    end

    private

    def grant!(code)
      points = code.points
      expires_at = code.credit_expires_at(@now)

      ActiveRecord::Base.transaction do
        # 総数の上限は行ロックの中で数える。外で数えると、同時に押されたぶんが上限を超える
        code.with_lock do
          raise Unavailable, UNAVAILABLE_MESSAGE if code.exhausted?

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
