module Api
  module V1
    module Admin
      # 引き換えコードの発行と成績。
      class CampaignCodesController < BaseController
        def index
          codes = CampaignCode.recent.to_a
          counts = CampaignRedemption.where(campaign_code_id: codes.map(&:id))
                                     .group(:campaign_code_id)
                                     .pluck(Arel.sql("campaign_code_id"), Arel.sql("COUNT(*)"), Arel.sql("COALESCE(SUM(points), 0)"))
                                     .to_h { |id, count, points| [ id, { count: count, points: points } ] }

          render json: {
            codes: codes.map { |code| serialize(code, counts[code.id]) },
            reward_types: CampaignCode::REWARD_TYPES,
            # 打つ人が読み違えないよう、字種を絞った候補を1つ添える
            suggested_code: CampaignCode.generate_code
          }
        end

        def create
          code = CampaignCode.new(code_params)
          code.code = CampaignCode.generate_code if code.code.blank?
          code.created_by = current_user

          if code.save
            audit!("campaign_code_create", details: { code: code.code, amount: code.amount })
            render json: { code: serialize(code, nil) }, status: :created
          else
            render json: { errors: code.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # 条件は後から変えられる。ただしコードそのものは変えない
        # （配ったあとに変えると、配った先で通らなくなる）
        def update
          code = CampaignCode.find(params[:id])
          before = code.slice(:enabled, :amount, :max_redemptions, :expires_at)

          if code.update(code_params.except(:code))
            audit!("campaign_code_update", details: { code: code.code, before: before })
            render json: { code: serialize(code, redemption_stats(code)) }
          else
            render json: { errors: code.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # 受け取られたコードは消さない。誰が何を受け取ったかの記録が消えるため、
        # 配布を止めたいときは無効にする
        def destroy
          code = CampaignCode.find(params[:id])
          if code.redemptions.exists?
            return render json: { error: "受け取られたコードは削除できません。無効にしてください。" },
                          status: :unprocessable_entity
          end

          code.destroy!
          audit!("campaign_code_destroy", details: { code: code.code })
          head :no_content
        end

        private

        def code_params
          params.require(:campaign_code).permit(
            :code, :label, :reward_type, :amount, :item_kind,
            :starts_at, :expires_at, :max_redemptions, :credit_valid_days, :enabled, :notes
          )
        end

        def redemption_stats(code)
          rows = code.redemptions.pick(Arel.sql("COUNT(*)"), Arel.sql("COALESCE(SUM(points), 0)"))
          { count: rows&.first.to_i, points: rows&.last.to_i }
        end

        def serialize(code, stats)
          redeemed = stats&.dig(:count).to_i
          {
            id: code.id,
            code: code.code,
            label: code.label,
            reward_type: code.reward_type,
            amount: code.amount,
            item_kind: code.item_kind,
            starts_at: code.starts_at,
            expires_at: code.expires_at,
            max_redemptions: code.max_redemptions,
            credit_valid_days: code.credit_valid_days,
            enabled: code.enabled,
            notes: code.notes,
            created_at: code.created_at,
            redeemed_count: redeemed,
            granted_credits: stats&.dig(:points).to_i.fdiv(::Billing::POINTS_PER_CREDIT),
            # 上限を決めていないコードに受け取り率は無い（分母が存在しない）。
            # 0 を返すと「誰も受け取っていない」と読めてしまうので nil で返す
            redemption_rate: code.max_redemptions.present? ? redeemed.fdiv(code.max_redemptions).round(3) : nil,
            available: code.available?
          }
        end
      end
    end
  end
end
