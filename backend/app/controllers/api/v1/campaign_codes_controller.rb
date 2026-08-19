module Api
  module V1
    # 引き換えコードの受け取り。
    class CampaignCodesController < BaseController
      before_action -> { deny_for_demo!(:redeem_code) }, only: :redeem

      # 引き換えの履歴に出す件数。これ以上は画面の「＋」で足す。
      # 3件にしているのは、ここが主役ではないから（主役は入力欄）。
      # 長い記録が常に開いていると、次に打つ場所が下へ押し出される
      HISTORY_LIMIT = 3

      # これまでに引き換えたもの。
      #
      # 引き換えは「押したら残高が増える」だけの操作なので、
      # 記録が見えないと、受け取ったのか打ち間違えたのかを後から確かめられない。
      def index
        # **自分でコードを打って受け取ったものだけ**を出す。
        #
        # 運営がまとめて配ったぶんも同じ kind: "campaign" で入るが、
        # あれは利用者が打った覚えのないもの。「引き換えた記録」に混ぜると、
        # 打っていないコードが並ぶことになり、身に覚えのない記録に見える。
        # 打った証拠は metadata の campaign_code（配布ぶんには入らない）。
        grants = current_user.credit_grants.where(kind: "campaign")
                             .where("metadata ->> 'campaign_code' IS NOT NULL")
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
