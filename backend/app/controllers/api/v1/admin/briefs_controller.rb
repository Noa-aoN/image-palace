module Api
  module V1
    module Admin
      # 経営の見立て。
      #
      # **開くたびには作らない。** 明示的に更新したときだけ AI を呼ぶ。
      # 画面を開くだけで走ると、見るだけの人が費用を積み上げることになる。
      class BriefsController < Api::V1::Admin::BaseController
        # 読むのは support 以上（経営の数字と同じ扱い）。
        # 作るのは operator 以上。AI を呼ぶので費用が出るし、記録として残るため
        before_action -> { require_role!(:operator) }, only: :create

        def show
          render json: { brief: serialize(latest) }
        end

        # 過去のぶんも並べる。**新しいものを上に。**
        # 何を言われて、何をやったかは、並べて初めて追える
        def index
          briefs = AdminBrief.recent.includes(:admin_insights, :admin_brief_actions).limit(LIST_LIMIT)

          render json: { briefs: briefs.map { |brief| serialize(brief) } }
        end

        def create
          # 直前に作ったばかりなら、それを返す。
          # 二度押しや、戻って押し直したときに、同じ数字から2つ作らないため
          existing = AdminBrief.recently_generated
          return render json: { brief: serialize(existing.reload) } if existing

          brief = ::Admin::BriefGenerator.call(user: current_user, period: params[:period].presence || "30d")
          AdminAuditLog.record!(actor: current_user, action: "admin.brief_generated", target: brief)

          render json: { brief: serialize(brief.reload) }, status: :created
        rescue ::Admin::BriefGenerator::GenerationError => e
          render json: { error: e.message }, status: :unprocessable_entity
        rescue Ai::Chat::LimitExceeded => e
          render json: { error: e.message }, status: :too_many_requests
        rescue Faraday::Error, KeyError => e
          Rails.logger.warn "[Admin::Briefs] failed: #{e.class}: #{e.message}"
          render json: { error: "AI の呼び出しに失敗しました。時間をおいてお試しください。" }, status: :bad_gateway
        end

        private

        # 一覧に出す件数。増えても読めないので打ち止めを置く
        LIST_LIMIT = 30

        def latest
          AdminBrief.recent.includes(:admin_insights, :admin_brief_actions).first
        end

        def serialize(brief)
          return nil unless brief

          {
            id: brief.id,
            generated_at: brief.created_at,
            period: { key: brief.period_key, from: brief.period_from, to: brief.period_to },
            summary: brief.summary,
            completeness: brief.completeness,
            model: brief.model,
            prompt_tokens: brief.prompt_tokens,
            completion_tokens: brief.completion_tokens,
            cost_credits: brief.cost_points.fdiv(::Billing::POINTS_PER_CREDIT).round(2),
            insights: brief.admin_insights.map { |insight| serialize_insight(insight) },
            actions: brief.admin_brief_actions.map { |action| serialize_action(action) }
          }
        end

        def serialize_action(action)
          {
            id: action.id,
            title: action.title,
            status: action.status,
            completed_at: action.completed_at,
            position: action.position
          }
        end

        def serialize_insight(insight)
          {
            id: insight.id,
            observation: insight.observation,
            evidence: insight.evidence,
            confidence: insight.confidence,
            impact: insight.impact,
            urgency: insight.urgency,
            suggested_action: insight.suggested_action,
            status: insight.status
          }
        end
      end
    end
  end
end
