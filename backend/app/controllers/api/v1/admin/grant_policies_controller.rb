module Api
  module V1
    module Admin
      # 付与ポリシー（何を・いくつ・どの条件で配るか）の確認と設定。
      class GrantPoliciesController < BaseController
        # 付与ポリシーは通常運用の範囲
        before_action -> { require_role!(:operator) }, only: [ :upsert, :destroy ]
        def index
          render json: {
            policies: GrantPolicy.overview,
            item_kinds: GrantPolicy::ITEM_KINDS,
            ready_item_kinds: GrantPolicy::READY_ITEM_KINDS,
            reward_types: GrantPolicy::REWARD_TYPES
          }
        end

        # キーごとに作成/更新する（画面で触ったときに初めて行ができる）
        def upsert
          policy = GrantPolicy.find_or_initialize_by(key: params[:key])
          before = policy.persisted? ? policy.slice(:enabled, :amount, :item_kind) : nil
          policy.reward_type = policy_params[:reward_type] if policy_params.key?(:reward_type)
          policy.assign_attributes(policy_params.except(:reward_type))
          policy.reward_type ||= GrantPolicy::DEFAULTS.dig(params[:key], :reward_type) || "credits"

          if policy.save
            audit!("grant_policy_update", details: { key: policy.key, before: before, after: policy.slice(:enabled, :amount, :item_kind) })
            render json: { policy: GrantPolicy.overview.find { |row| row[:key] == policy.key } }
          else
            render json: { errors: policy.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # 既定へ戻す（行を消せば Billing::Catalog の値で動く）
        def destroy
          policy = GrantPolicy.find_by!(key: params[:key])
          policy.destroy!
          audit!("grant_policy_reset", details: { key: params[:key] })

          render json: { policy: GrantPolicy.overview.find { |row| row[:key] == params[:key] } }
        end

        private

        def policy_params
          params.require(:policy).permit(:enabled, :amount, :item_kind, :notes, :reward_type, conditions: {})
        end
      end
    end
  end
end
