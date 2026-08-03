module Api
  module V1
    module Admin
      # 管理操作の記録。読むだけで、消したり書き換えたりはできない。
      class AuditLogsController < BaseController
        DEFAULT_LIMIT = 50
        MAX_LIMIT = 200

        def index
          logs = AdminAuditLog.recent.limit(limit)
          render json: {
            logs: logs.map do |log|
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
          }
        end

        private

        def limit
          requested = params[:limit].to_i
          return DEFAULT_LIMIT if requested <= 0

          [ requested, MAX_LIMIT ].min
        end
      end
    end
  end
end
