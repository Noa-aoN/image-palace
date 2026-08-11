# frozen_string_literal: true

module Wikipedia
  # 題が一致しなかったときに、近い記事を探す。
  #
  # **選ぶのは利用者**。ここは候補を並べるだけで、どれかを選んでは返さない。
  # 一番上を勝手に採ると、同名の別人・別作品が黙って card に入る。
  # 「アポロン」で神と探査計画のどちらが欲しいかは、こちらには分からない。
  #
  # 題だけでは見分けが付かないので、一行の説明も一緒に返す。
  # 「Mycenaean Greece（青銅器時代のギリシャ文明）」と
  # 「Mycenaean Greek（ギリシャ語の最古の形）」は、題だけなら1文字違いでしかない。
  #
  # 要約（SummaryFetcher）と同じ作法にする。名乗り・待たない・落ちても壊さない。
  class CandidateSearch
    SEARCH_PATH = "/w/rest.php/v1/search/title"

    # 出す候補の数。多いと選ぶのが仕事になる。少ないと正解が漏れる
    LIMIT = 5

    OPEN_TIMEOUT = 2
    READ_TIMEOUT = 3
    CACHE_TTL = 24.hours

    Candidate = Struct.new(:title, :description, :thumbnail_url, keyword_init: true) do
      def to_h
        {
          "title" => title,
          "description" => description,
          "thumbnail_url" => thumbnail_url
        }.compact
      end
    end

    Result = Struct.new(:candidates, :language_code, keyword_init: true) do
      # どれも語をかすっていない状態。候補は出すが、言い直しを勧める。
      #
      # 候補を消してしまわないのは、表記が違うだけの正解を捨てないため
      # （「ミトコンドリア」に対する「ミトコンドリアDNA」など）。
      def weak?(term)
        return true if candidates.empty?

        normalized = CandidateSearch.normalize(term)
        candidates.none? { |c| CandidateSearch.normalize(c.title).include?(normalized) }
      end
    end

    # 比べるための均し。大文字小文字と空白の違いで「かすってもいない」とは言わせない
    def self.normalize(text)
      text.to_s.downcase.gsub(/[[:space:]_]+/, "")
    end

    def self.call(term, language_code: nil)
      new(term, language_code: language_code).call
    end

    def initialize(term, language_code: nil)
      @term = term.to_s.strip
      @language_code = Language.normalize(language_code) || Language::DEFAULT
    end

    def call
      return empty if @term.blank?

      cached = Rails.cache.read(cache_key)
      return cached if cached

      result = search
      # 引けなかったことはキャッシュしない。次に開いたときは繋がるかもしれない
      Rails.cache.write(cache_key, result, expires_in: CACHE_TTL) if result
      result || empty
    end

    private

    def empty
      Result.new(candidates: [], language_code: @language_code)
    end

    def cache_key
      "wikipedia:search:#{@language_code}:#{Digest::SHA256.hexdigest(@term.downcase)}"
    end

    def search
      response = connection.get(SEARCH_PATH, q: @term, limit: LIMIT)
      build(response.body)
    rescue Faraday::Error, JSON::ParserError => e
      # 落ちている・遅い・返事が読めない。どれもカードの読み書きを止める理由にはならない
      Rails.logger.warn "[Wikipedia] SEARCH FAILED term_len=#{@term.length} #{e.class}: #{e.message}"
      nil
    end

    def build(body)
      return nil unless body.is_a?(Hash)

      candidates = Array(body["pages"]).filter_map do |page|
        next if page["title"].blank?

        Candidate.new(
          title: page["title"],
          description: page["description"],
          # 画像は URL を指すだけ。ファイルはこちらに持たない
          # （記事本文とは別のライセンスが付くことがあるため）
          thumbnail_url: page.dig("thumbnail", "url").then { |u| u.presence && absolute(u) }
        )
      end

      Result.new(candidates: candidates.first(LIMIT), language_code: @language_code)
    end

    # 検索APIのサムネイルは `//upload.wikimedia.org/...` で返ることがある。
    # そのまま出すと、ページの仕組みによっては読み込めない
    def absolute(url)
      url.start_with?("//") ? "https:#{url}" : url
    end

    def connection
      @connection ||= Faraday.new(url: Language.base_url(@language_code)) do |f|
        f.response :json
        f.response :raise_error
        f.options.open_timeout = OPEN_TIMEOUT
        f.options.timeout = READ_TIMEOUT
        # Wikimedia の方針に合わせて両方付ける（要約と同じ）
        f.headers["User-Agent"] = SummaryFetcher.user_agent
        f.headers["Api-User-Agent"] = SummaryFetcher.user_agent
        f.headers["Accept"] = "application/json"
      end
    end
  end
end
