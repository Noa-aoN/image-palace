module Api
  module V1
    # Wikipedia の記事の冒頭を引く。
    #
    # フロントから直接叩かずここを通すのは、Wikimedia が求める User-Agent を
    # 付けるため・こちらでキャッシュするため・許可する外部ホストを増やさないため。
    #
    # 引けなくても 200 を返す（found: false）。ここで 5xx を返すと、
    # 画面が「壊れた」と見せることになる。引けないのは異常ではない。
    class WikipediaController < BaseController
      def summary
        result = ::Wikipedia::SummaryFetcher.call(params[:q], language_code: language_code)

        if result.nil?
          return render json: {
            found: false, language_code: language_code, message: "いま引けませんでした"
          }, status: :ok
        end

        render json: {
          found: true,
          summary: result.to_h,
          language_code: result.language_code,
          disambiguation: result.disambiguation?
        }, status: :ok
      end

      # 題が一致しなかったときに、近い記事を並べる。
      #
      # **ここでは保存しない。** 返すのは候補だけで、画面が1件を選んだあと
      # 改めて summary を引いて保存する。一番上を勝手に採ると、同名の別人・
      # 別作品が黙って card に入る。
      def search
        result = ::Wikipedia::CandidateSearch.call(params[:q], language_code: language_code)
        weak = result.weak?(params[:q])

        render json: {
          candidates: result.candidates.map(&:to_h),
          language_code: result.language_code,
          weak: weak,
          message: weak_message(result)
        }, status: :ok
      end

      private

      # 「弱い」ことを隠さない。候補は出したうえで、言い直しを勧める
      def weak_message(result)
        return "見つかりませんでした。別の語で試してください。" if result.candidates.empty?
        return nil unless result.weak?(params[:q])

        "近い記事が見つかりませんでした。より具体的な語で検索してください。"
      end

      # どの言語版を引くか。上から順に見て、最初に引ける言語を使う。
      #
      #   1. 求めに付いてきた言語（カードの言語プロパティ。画面が渡す）
      #   2. 利用者の表示言語
      #   3. ブラウザの言語
      #   4. ja
      #
      # いまは画面に言語の選択を出していないので、実際はほぼ ja になる。
      # それでも順番をここに書いておくのは、出すときに配線を探し回らずに済むため。
      def language_code
        @language_code ||= ::Wikipedia::Language.resolve(
          params[:language_code],
          current_user&.setting&.locale,
          ::Wikipedia::Language.from_accept_language(request.headers["Accept-Language"])
        )
      end
    end
  end
end
