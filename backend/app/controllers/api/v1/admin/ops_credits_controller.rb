module Api
  module V1
    module Admin
      # 運営クレジット。**運営の予算を、自分の残高へ入れる。**
      #
      # 以前は運営だけ別の財布から引かれていて、残高が1点も動かなかった。
      # そのため数え方の不具合にも、使いすぎにも気づけなかった。
      #
      # いまは「入れる」と「使う」を分ける。
      #   入れる … ここ（月ごとの上限つき）
      #   使う   … ほかの利用者とまったく同じ道
      class OpsCreditsController < BaseController
        before_action -> { require_role!(:operator) }, only: [ :create ]

        # 今月いくら引き出して、いくら使い、いま何が残っているか
        def index
          render json: { accounts: ops_accounts.map { |user| serialize_account(user) } }
        end

        # 自分の残高へ入れる。
        #
        # **理由を必須にする。** あとから見て「なぜ入れたか」が分からない
        # 記録は、記録として使えない（手で配る操作と同じ扱いにする）。
        #
        # 入れ先は自分だけ。他人の残高を触るのは別の話（お詫び・調整）で、
        # ここに混ぜると「運営の予算」の意味が薄まる。
        def create
          credits = params[:credits].to_f
          reason = params[:reason].to_s.strip

          return render(json: { error: "理由を書いてください" }, status: :unprocessable_entity) if reason.blank?
          return render(json: { error: "1クレジット以上で指定してください" }, status: :unprocessable_entity) if credits < 1

          points = (credits * ::Billing::POINTS_PER_CREDIT).round
          current_user.draw_studio_allowance!(points, reason: reason)
          audit!("ops_credit_draw", target: current_user, details: { credits: credits, reason: reason })

          render json: serialize_account(current_user.reload), status: :created
        rescue StudioAllowance::OverAllowance => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        # 運営の予算を使える人。**役割ではなく、その能力で選ぶ**
        # （能力の決め方が変わっても、ここは書き換えなくてよい）
        def ops_accounts
          User.where.not(role: "user").to_a.select(&:studio_allowance?).presence || [ current_user ]
        end

        def serialize_account(user)
          from = StudioAllowance.period_start
          {
            id: user.id,
            label: user.name.presence || user.email.to_s.split("@").first,
            allowance: user.studio_allowance_summary,
            available_credits: user.available_credits,
            # 今月使ったぶん。**入れた量ではなく、実際に減った量**
            spent_credits: spent_points(user, from).abs.fdiv(::Billing::POINTS_PER_CREDIT),
            # 今月つくった絵の枚数。**API を呼んだぶんだけ**
            # （キャッシュで済んだものは費用が出ていないので数えない）
            generated_images: ImageUsage.billed.where(user_id: user.id, created_at: from..).count
          }
        end

        def spent_points(user, from)
          user.credit_transactions.where(kind: "consumption", created_at: from..).sum(:delta)
        end
      end
    end
  end
end
