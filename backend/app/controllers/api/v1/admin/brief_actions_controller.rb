module Api
  module V1
    module Admin
      # 「次にやること」。**終わったかどうかだけ**を持つ。
      #
      # 大きな課題管理にはしない。Issue や PR は GitHub 側の話で、
      # ここが持つのは「言われたことを、やったかどうか」だけ。
      class BriefActionsController < Api::V1::Admin::BaseController
        before_action -> { require_role!(:operator) }, only: :update

        FILTERS = %w[open done all].freeze

        def index
          scope = AdminBriefAction.recent.includes(:admin_brief)
          scope = scope.open_ones if filter == "open"
          scope = scope.done_ones if filter == "done"

          render json: { filter: filter, actions: scope.limit(200).map { |row| serialize(row) } }
        end

        def update
          action = AdminBriefAction.find(params[:id])
          # 消さない。**やったことも、やらなかったことも、次の見立ての材料になる**
          params[:status].to_s == "done" ? action.done! : action.reopen!

          render json: { action: serialize(action) }
        end

        private

        # 既定は未完了。開いた人がまず見たいのは、まだ残っているもの
        def filter
          FILTERS.include?(params[:status].to_s) ? params[:status].to_s : "open"
        end

        def serialize(action)
          {
            id: action.id,
            title: action.title,
            status: action.status,
            completed_at: action.completed_at,
            brief_id: action.admin_brief_id,
            # いつ言われたことか。古いまま残っているものが分かる
            generated_at: action.admin_brief.created_at
          }
        end
      end
    end
  end
end
