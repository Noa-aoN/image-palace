module Api
  module V1
    class WordsController < BaseController
      # テーマ/ジャンルから学習単語を生成して返す（テキストのみ＝クレジット消費なし）。
      # ワードリスト作成フォームとデルフォイ（ガチャ）から利用する。
      def generate
        # count 未指定（nil/空）は「おまかせ（自動）」としてサービス側に委ねる。
        # exclude=既出（絶対に出さない）, avoid=キャンセル済み（確率を大きく下げる）。
        # 実在の確認は数の少ない呼び出しだけに掛ける。
        # 1語ごとに Wikipedia を引くので、50語まとめて作るワードリストで回すと
        # 待ち時間が現実的でなくなる。デルフォイは最大5語なので確かめられる。
        words = GenerateWordsService.call(
          theme: params[:theme],
          count: params[:count].presence,
          exclude: params[:exclude],
          avoid: params[:avoid],
          difficulty: params[:difficulty].presence || current_user.setting&.word_difficulty,
          user: current_user,
          verify: verify_existence?
        )
        render json: { words: words }
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue GenerateWordsService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[WordsController#generate] failed: #{e.class}: #{e.message}"
        render json: { error: "単語の生成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # 実在を確かめる件数の上限。これ以下なら1語ずつ引いても待たせすぎない
      VERIFY_MAX_COUNT = 5

      private

      def verify_existence?
        requested = params[:count].to_i
        requested.positive? && requested <= VERIFY_MAX_COUNT
      end

      public

      # 単語リストがテーマに沿っているかを点検し、訂正・追加の提案を返す（クレジット消費なし）。
      # 提案の適用はフロント側でユーザーが一件ずつ承認する。
      def check
        result = CheckWordsService.call(theme: params[:theme], words: params[:words], user: current_user)
        render json: { issues: result.issues, additions: result.additions }
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue CheckWordsService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[WordsController#check] failed: #{e.class}: #{e.message}"
        render json: { error: "単語の点検に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end
    end
  end
end
