module Api
  module V1
    # 引き換えコードの受け取り。
    class CampaignCodesController < BaseController
      # 引き換えの履歴に出す件数。これ以上は「もっと見る」で足す
      HISTORY_LIMIT = 10

      # これまでに引き換えたもの。
      #
      # 引き換えは「押したら残高が増える」だけの操作なので、
      # 記録が見えないと、受け取ったのか打ち間違えたのかを後から確かめられない。
      def index
        grants = current_user.credit_grants.where(kind: "campaign")
                             .order(created_at: :desc)
                             .limit(limit + 1)
        rows = grants.to_a

        render json: {
          redemptions: rows.first(limit).map { |grant| serialize(grant) },
          # 次があるかは1件多く引いて判断する（総数を数えるより安い）
          has_more: rows.size > limit
        }
      end

      def redeem
        result = ::Billing::RedeemCampaignCode.call(user: current_user, code: params[:code])

        render json: {
          credits: result.credits,
          label: result.label,
          expires_at: result.expires_at,
          # 受け取り直後の残高。画面が別途問い合わせなくて済む
          available_credits: current_user.reload.available_credits
        }, status: :ok
      rescue ::Billing::RedeemCampaignCode::Error => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def limit
        requested = params[:limit].to_i
        return HISTORY_LIMIT if requested <= 0

        [ requested, 100 ].min
      end

      def serialize(grant)
        {
          id: grant.id,
          code: grant.metadata["campaign_code"],
          credits: grant.amount_points.fdiv(::Billing::POINTS_PER_CREDIT),
          # 使い切ったかどうかも出す。残っていると思って探しに来る人がいる
          remaining_credits: grant.remaining_points.fdiv(::Billing::POINTS_PER_CREDIT),
          expires_at: grant.expires_at,
          redeemed_at: grant.created_at
        }
      end
    end
  end
end
