module Api
  module V1
    module Billing
      # クレジットの増減の明細。
      #
      # 「いつ・何で・いくら増えた／減った」が追えないと、残高が合わないときに
      # 利用者も運営も確かめようがない。台帳はもともと追記のみで持っているので、それを見せる。
      class CreditTransactionsController < Api::V1::BaseController
        DEFAULT_LIMIT = 50
        MAX_LIMIT = 200

        def index
          rows, next_cursor = paginate(current_user.credit_transactions.recent)

          render json: {
            transactions: rows.map { |row| serialize(row) },
            next_cursor: next_cursor
          }
        end

        private

        # 明細は増え続けるので、続きは作成時刻のカーソルでたどる（深い位置でも重くならない）
        def paginate(scope)
          scope = scope.where(created_at: ...cursor) if cursor
          rows = scope.limit(limit + 1).to_a
          has_more = rows.size > limit
          rows = rows.first(limit)
          [ rows, has_more ? rows.last&.created_at&.iso8601(6) : nil ]
        end

        def serialize(row)
          {
            id: row.id,
            kind: row.kind,
            label: row.label,
            credits: row.credits,
            description: row.description,
            item_id: row.item_id,
            # 残高の推移が追えるよう、その時点の内訳も返す
            subscription_credits_after: after_credits(row.subscription_credits_after),
            topup_credits_after: after_credits(row.topup_credits_after),
            created_at: row.created_at
          }
        end

        def after_credits(points)
          return nil if points.nil?

          points.fdiv(::Billing::POINTS_PER_CREDIT)
        end

        def cursor
          return nil if params[:cursor].blank?

          Time.iso8601(params[:cursor])
        rescue ArgumentError
          nil
        end

        def limit
          requested = params[:limit].to_i
          return DEFAULT_LIMIT if requested <= 0

          [ requested, MAX_LIMIT ].min
        end
      end
    end
  end
end
