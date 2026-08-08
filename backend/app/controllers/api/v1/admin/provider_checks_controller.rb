module Api
  module V1
    module Admin
      # 供給側（OpenAI）の疎通確認。押したときだけ実際に1回呼ぶ。
      class ProviderChecksController < BaseController
        def create
          result = ::Admin::ProviderCheckService.call
          audit!("provider_check", details: { ok: result.ok, code: result.code })

          render json: {
            ok: result.ok,
            code: result.code,
            message: result.message,
            checked_at: Time.current
          }
        end
      end
    end
  end
end
