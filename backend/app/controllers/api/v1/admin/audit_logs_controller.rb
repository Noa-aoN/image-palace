module Api
  module V1
    module Admin
      # 管理操作の記録。読むだけで、消したり書き換えたりはできない。
      class AuditLogsController < BaseController
        DEFAULT_LIMIT = 50
        MAX_LIMIT = 200

        def index
          logs = filtered.recent.limit(limit)

          render json: {
            logs: logs.map { |log| serialize(log) },
            # 絞り込みの選択肢。操作の種類が増えたので、一覧から拾って出す
            actions: AdminAuditLog.distinct.order(:action).pluck(:action),
            actors: AdminAuditLog.where.not(actor_email: nil).distinct.order(:actor_email).pluck(:actor_email)
          }
        end

        private

        def filtered
          scope = AdminAuditLog.all
          scope = scope.where(action: params[:action_name]) if params[:action_name].present?
          scope = scope.where(actor_email: params[:actor]) if params[:actor].present?
          scope
        end

        def serialize(log)
          {
            id: log.id,
            actor_email: log.actor_email,
            action: log.action,
            target_type: log.target_type,
            target_id: log.target_id,
            details: log.details,
            created_at: log.created_at
          }
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
