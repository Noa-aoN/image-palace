module Api
  module V1
    module Billing
      # 画像以外の AI 利用（意味・タグ・ファクトチェック等）の内訳を返す。
      #
      # 画像はクレジットで数えられるが、文章生成は何回呼ばれているかが見えていなかった。
      # 「利用と支払い」から自分の使い方を確認できるようにする。
      class AiUsagesController < Api::V1::BaseController
        # 直近何日ぶんを見せるか（既定は30日、最大90日）
        DEFAULT_DAYS = 30
        MAX_DAYS = 90

        def show
          since = days.days.ago
          rows = AiUsage.where(user_id: current_user.id).since(since)
                        .group(:kind)
                        .pluck(
                          Arel.sql("kind"),
                          Arel.sql("COUNT(*)"),
                          Arel.sql("COALESCE(SUM(prompt_tokens + completion_tokens), 0)"),
                          Arel.sql("COALESCE(SUM(cost_points), 0)")
                        )

          breakdown = rows.map do |kind, count, tokens, points|
            {
              kind: kind,
              label: AiUsage.label_for(kind),
              count: count,
              tokens: tokens,
              credits: points.fdiv(::Billing::POINTS_PER_CREDIT)
            }
          end.sort_by { |row| -row[:count] }

          render json: {
            days: days,
            since: since,
            total_count: breakdown.sum { |row| row[:count] },
            total_tokens: breakdown.sum { |row| row[:tokens] },
            total_credits: breakdown.sum { |row| row[:credits] },
            daily_cap: Ai::UsageLimit.daily_call_cap,
            used_today: AiUsage.where(user_id: current_user.id).since(24.hours.ago).count,
            breakdown: breakdown
          }
        end

        private

        def days
          requested = params[:days].to_i
          return DEFAULT_DAYS if requested <= 0

          [ requested, MAX_DAYS ].min
        end
      end
    end
  end
end
