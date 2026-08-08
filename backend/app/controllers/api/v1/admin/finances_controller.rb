module Api
  module V1
    module Admin
      # 支出入の概算。単価の設定と、請求実額の入力もここで受ける。
      class FinancesController < BaseController
        def show
          now = Time.zone.now
          year = params[:year].presence&.to_i || now.year
          month = params[:month].presence&.to_i || now.month

          render json: {
            summary: ::Admin::FinanceService.call(year: year, month: month),
            # 開業から今までの積み上げ
            totals: ::Admin::FinanceService.totals,
            # 月選択に出す候補（データがある範囲）
            available_months: available_months,
            # 直近12か月の推移（概算の粗利）
            trend: trend(now),
            parameters: CostParameter.overview,
            groups: CostParameter::GROUPS
          }
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

        # 概要に出す推移。月ごとに1回ずつ集計する（対象は12か月なので許容範囲）
        def trend(now)
          (0..11).map do |offset|
            date = now.beginning_of_month - offset.months
            summary = ::Admin::FinanceService.call(year: date.year, month: date.month)
            {
              year: date.year,
              month: date.month,
              revenue: summary[:revenue][:total],
              cost: summary[:cost][:total],
              profit: summary[:profit]
            }
          end.reverse
        end
      end
    end
  end
end
