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
        result = ::Wikipedia::SummaryFetcher.call(params[:q])

        if result.nil?
          return render json: { found: false, message: "いま引けませんでした" }, status: :ok
        end

        render json: { found: true, summary: result.to_h, disambiguation: result.disambiguation? }, status: :ok
      end
    end
  end
end
