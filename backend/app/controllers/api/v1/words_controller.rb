module Api
  module V1
    class WordsController < BaseController
      # テーマ/ジャンルから学習単語を生成して返す（テキストのみ＝クレジット消費なし）。
      # ワードリスト作成フォームとデルフォイ（ガチャ）から利用する。
      def generate
        # count 未指定（nil/空）は「おまかせ（自動）」としてサービス側に委ねる。
        words = GenerateWordsService.call(theme: params[:theme], count: params[:count].presence)
        render json: { words: words }
      rescue GenerateWordsService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[WordsController#generate] failed: #{e.class}: #{e.message}"
        render json: { error: "単語の生成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end
    end
  end
end
