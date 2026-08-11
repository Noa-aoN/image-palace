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

      private

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
