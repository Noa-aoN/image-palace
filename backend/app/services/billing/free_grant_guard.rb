# frozen_string_literal: true

module Billing
  # 無料枠の配りすぎを止めるブレーカー。
  #
  # お試し枠は1アカウント1回にしてあるが、それだけでは
  # 「大量にアカウントを作って集める」使い方には効かない。
  #
  # 1日に配る総量に上限を置く。普通に人が増えていく限り当たらない値にし、
  # 当たったときは配るのをやめて記録に残す。異常に気づけないまま
  # 原価だけが出続けるのを防ぐのが目的。
  #
  # 誰か1人を止めるのではなく全体を止めるので、まっとうな新規登録も
  # 巻き込む。だからこそ、当たった時点で気づけるようにしておく。
  module FreeGrantGuard
    module_function

    # 1日（24時間）に配ってよい無料クレジットの上限（クレジット）
    DEFAULT_DAILY_CAP = 500

    def daily_cap
      ENV.fetch("FREE_GRANT_DAILY_CAP", DEFAULT_DAILY_CAP.to_s).to_i
    end

    # amount_points ぶんを配ってよいか
    def allow?(amount_points)
      cap = daily_cap
      return true if cap <= 0

      granted = CreditGrant.where(kind: %w[trial monthly_free], created_at: 24.hours.ago..).sum(:amount_points)
      return true if (granted + amount_points) <= cap * Billing::POINTS_PER_CREDIT

      report_capped!(granted)
      false
    end

    def report_capped!(granted_points)
      message = "[free grant] DAILY CAP REACHED granted=#{granted_points.fdiv(Billing::POINTS_PER_CREDIT)}cr " \
                "cap=#{daily_cap}cr"
      Rails.logger.error(message)
      Sentry.capture_message(message, level: :error) if defined?(Sentry)
    end
  end
end
