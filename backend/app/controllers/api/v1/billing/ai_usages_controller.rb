module Api
  module V1
    module Billing
      # 「利用と支払い」に出す使用量（AI の利用・クレジットの消費・カードの作成）。
      #
      # 画像はクレジットで数えられるが、文章生成は何回呼ばれているかが見えていなかった。
      # 期間を選んで、自分の使い方を確認できるようにする。
      class AiUsagesController < Api::V1::BaseController
        def show
          render json: ::Billing::UsageSummaryService.call(user: current_user, period: params[:period])
        end
      end
    end
  end
end
