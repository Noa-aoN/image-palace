# frozen_string_literal: true

module Wikipedia
  # 曖昧さ回避ページに**並んでいる記事**を取り出す。
  #
  # ## なぜ要るのか
  #
  # 「アポロン」「水星」のような多義語を引くと、Wikipedia は
  # 「ウィキメディアの曖昧さ回避ページ」を返す。中身は行き先の一覧なので、
  # 冒頭を保存しても意味が取れない。
  #
  # これまではここで行き止まりだった。候補として曖昧さ回避ページが出て、
  # 選ぶと「その記事は引けませんでした」と言われる。**利用者から見れば、
  # 出された選択肢を選んだのに断られている。**
  #
  # 曖昧さ回避ページは「どれですか」と訊いている一覧なので、
  # そのまま次の選択肢として出せばよい。ここはその一覧を引く。
  #
  # ## 引き方
  #
  # 本文を読んで一覧を組み立てるのではなく、**そのページから出ている
  # 記事へのリンク**を取る（generator=links）。説明文とサムネイルも一度に取れるので、
  # 「アポロン（ギリシア神話の神）」と「アポロン（曲）」を見分けられる。
  #
  # 要約・検索と同じ作法にする。名乗り・待たない・落ちても壊さない。
  class DisambiguationEntries
    API_PATH = "/w/api.php"

    # 出す数。曖昧さ回避ページは20件を超えることもあるが、
    # それ以上並べると選ぶのが仕事になる
    LIMIT = 20
    # 引く数。並び順の上位を採るために、出す数より多めに引く
    FETCH_LIMIT = 60

    OPEN_TIMEOUT = 2
    READ_TIMEOUT = 3
    CACHE_TTL = 24.hours

    # 曖昧さ回避ページから、また別の曖昧さ回避ページへ行くことがある。
    # 選んでも同じ画面に戻るだけなので、一覧から外す
    DISAMBIGUATION_HINTS = [ "曖昧さ回避", "disambiguation" ].freeze

    Result = Struct.new(:candidates, :language_code, keyword_init: true)

    def self.call(title, language_code: nil)
      new(title, language_code: language_code).call
    end

    def initialize(title, language_code: nil)
      @title = title.to_s.strip
      @language_code = Language.normalize(language_code) || Language::DEFAULT
    end

    def call
      return empty if @title.blank?

      cached = Rails.cache.read(cache_key)
      return cached if cached

      result = fetch
      # 引けなかったことはキャッシュしない
      Rails.cache.write(cache_key, result, expires_in: CACHE_TTL) if result
      result || empty
    end

    private

    def empty
      Result.new(candidates: [], language_code: @language_code)
    end

    def cache_key
      "wikipedia:disambiguation:#{@language_code}:#{Digest::SHA256.hexdigest(@title.downcase)}"
    end

    def fetch
      response = connection.get(API_PATH, query_params)
      build(response.body)
    rescue Faraday::Error, JSON::ParserError => e
      Rails.logger.warn "[Wikipedia] DISAMBIGUATION FAILED title_len=#{@title.length} #{e.class}: #{e.message}"
      nil
    end

    def query_params
      {
        action: "query", format: "json", formatversion: 2,
        # そのページから出ているリンクを、そのままページの一覧として引く
        generator: "links", titles: @title,
        gpllimit: FETCH_LIMIT,
        # 記事だけ。案内ページやテンプレートは選択肢にならない
        gplnamespace: 0,
        prop: "description|pageimages",
        piprop: "thumbnail", pithumbsize: 80,
        redirects: 1
      }
    end

    def build(body)
      return nil unless body.is_a?(Hash)

      pages = Array(body.dig("query", "pages"))
      # index は曖昧さ回避ページに書かれている順。**その順が読み手の期待に近い**
      # （上から順に主要な意味が並んでいる）
      candidates = pages.sort_by { |page| page["index"].to_i }.filter_map { |page| candidate_for(page) }
      Result.new(candidates: candidates.first(LIMIT), language_code: @language_code)
    end

    def candidate_for(page)
      title = page["title"].to_s
      return nil if title.blank?
      # まだ書かれていない記事。選んでも引けない
      return nil if page["missing"]
      return nil if same_page?(title)
      return nil if disambiguation?(page)

      CandidateSearch::Candidate.new(
        title: title,
        description: page["description"],
        thumbnail_url: page.dig("thumbnail", "source")
      )
    end

    def same_page?(title)
      CandidateSearch.normalize(title) == CandidateSearch.normalize(@title)
    end

    def disambiguation?(page)
      description = page["description"].to_s.downcase
      DISAMBIGUATION_HINTS.any? { |hint| description.include?(hint) }
    end

    def connection
      @connection ||= Faraday.new(url: Language.base_url(@language_code)) do |f|
        f.response :json
        f.response :raise_error
        f.options.open_timeout = OPEN_TIMEOUT
        f.options.timeout = READ_TIMEOUT
        f.headers["User-Agent"] = SummaryFetcher.user_agent
        f.headers["Api-User-Agent"] = SummaryFetcher.user_agent
        f.headers["Accept"] = "application/json"
      end
    end
  end
end
