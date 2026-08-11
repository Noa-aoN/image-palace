module Api
  module V1
    module Admin
      # 支出入の概算。単価の設定と、請求実額の入力もここで受ける。
      class FinancesController < BaseController
        # 原価・単価の想定値。粗利の下限判定に使われるので、最上位だけが触れる
        before_action -> { require_role!(:admin) }, only: [ :update_parameter, :update_actual ]
        def show
          now = Time.zone.now
          # 期間の決め方は他の運営画面と共通（Admin::Period）。
          # ここだけ独自の選び方だと、同じ「7月」で違う範囲を見ることになる。
          # 既定は今月（締めた月の実績を見に来る面なので、直近◯日ではない）
          period = ::Admin::Period.resolve(requested_period(now), now: now, default: current_month_key(now))
          # 単価はどの集計でも同じものを見る。1回だけ読む
          costs = CostParameter.table

          render json: {
            summary: summary_for(period, costs),
            period: period.to_h.merge(options: ::Admin::Period.options(now: now)),
            # 開業から今までの積み上げ
            totals: ::Admin::FinanceService.totals,
            # 月選択に出す候補（データがある範囲）。period.options.months と同じものだが、
            # 既にこれを見ている画面があるので残す
            available_months: available_months,
            # 直近12か月の推移（概算の粗利）
            trend: ::Admin::FinanceTrendService.call(now: now, costs: costs),
            parameters: CostParameter.overview,
            groups: CostParameter::GROUPS
          }
        end

        # 月を選んだときは「その月」として数える（インフラ月額を1か月ぶんで掛ける）。
        # 直近◯日や全期間のときは、日付の範囲をそのまま渡す
        def summary_for(period, costs)
          if period.key.match?(::Admin::Period::MONTH_FORMAT)
            year, month = period.key.split("-").map(&:to_i)
            ::Admin::FinanceService.call(year: year, month: month, costs: costs)
          else
            ::Admin::FinanceService.new(from: period.from, to: period.to, costs: costs).call
          end
        end

        def current_month_key(now)
          format("%04d-%02d", now.year, now.month)
        end

        # period を優先しつつ、以前の year / month も受ける。
        # 画面を先に壊さないため（切り替え終わったら消してよい）
        def requested_period(now)
          return params[:period] if params[:period].present?
          return nil if params[:year].blank? || params[:month].blank?

          format("%04d-%02d", params[:year].to_i, params[:month].to_i)
        end

        # 単価の変更（キーごとに作成/更新）
        def update_parameter
          parameter = CostParameter.find_or_initialize_by(key: params[:key])
          parameter.assign_attributes(parameter_params)

          if parameter.save
            audit!("cost_parameter_update", details: { key: parameter.key, value: parameter.value })
            render json: { parameter: CostParameter.overview.find { |row| row[:key] == parameter.key } }
          else
            render json: { errors: parameter.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # 請求実額の入力（月ごと）
        def update_actual
          actual = MonthlyActual.find_or_initialize_by(year: params[:year].to_i, month: params[:month].to_i)
          actual.assign_attributes(actual_params)

          if actual.save
            audit!("monthly_actual_update", details: { year: actual.year, month: actual.month, total: actual.total_jpy })
            render json: { summary: ::Admin::FinanceService.call(year: actual.year, month: actual.month) }
          else
            render json: { errors: actual.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def parameter_params
          params.require(:parameter).permit(:value, :note)
        end

        def actual_params
          params.require(:actual).permit(:openai_jpy, :infra_jpy, :other_jpy, :note)
        end

        # 選べる月。最初の登録・決済がある月から今月まで
        def available_months
          first = [ User.minimum(:created_at), CreditTransaction.minimum(:created_at) ].compact.min
          return [] if first.nil?

          months = []
          cursor = first.beginning_of_month
          last = Time.zone.now.beginning_of_month
          while cursor <= last
            months << { year: cursor.year, month: cursor.month }
            cursor = cursor.next_month
          end
          months.reverse
        end
      end
    end
  end
end
