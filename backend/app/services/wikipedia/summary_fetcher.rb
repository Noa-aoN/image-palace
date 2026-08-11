# frozen_string_literal: true

module Wikipedia
  # Wikipedia の記事の冒頭を引く。
  #
  # 引くのはサーバー側だけにする。フロントから直接叩かない理由は3つ。
  #   1. ブラウザは User-Agent を上書きするので、Wikimedia の方針を守れない（403 になる）
  #   2. 利用者の数だけ Wikipedia を叩くことになり、こちらでキャッシュできない
  #   3. CSP の connect-src に外部ホストを足すことになる（許可先は増やさない方針）
  #
  # 取るのは要約（冒頭・題名・記事URL・サムネイルのURL）だけ。全文は取らない。
  # 保存するのも冒頭までで、記事そのものを持たない。
  #
  # **落ちても壊さない。** ここで例外を投げると、カードを開くことも直すこともできなくなる。
  # 引けなかったときは nil を返し、呼び出し側は保存済みの値か「いま引けません」を出す。
  class SummaryFetcher
    BASE_URL = "https://ja.wikipedia.org"
    SUMMARY_PATH = "/api/rest_v1/page/summary/"

    # 保存する冒頭の長さ。これ以上は記事へ渡す（長文は保存しない方針）
    MAX_EXTRACT_LENGTH = 500

    # 待たない。ここは調べものの補助で、待たせてまで出すものではない
    OPEN_TIMEOUT = 2
    READ_TIMEOUT = 3

    # 同じ語を何度も引かない。記事の冒頭が1日で変わることはまず無い
    CACHE_TTL = 24.hours

    # Wikimedia は誰が叩いているか分かる User-Agent を求める。
    # 連絡先の無いもの・ブラウザを騙るものは弾かれる。
    # 連絡先は環境変数で差し替えられるようにしておく（引っ越しても直せるように）
    def self.user_agent
      contact = ENV.fetch("WIKIPEDIA_CONTACT", "https://imagepalace.app")
      "ImagePalace/1.0 (#{contact})"
    end

    Result = Struct.new(:title, :url, :extract, :thumbnail_url, :lang, :type, :fetched_at, keyword_init: true) do
      # 曖昧さ回避のページ。中身は一覧なので、そのまま出しても意味が取れない
      def disambiguation? = type == "disambiguation"

      def to_h
        {
          "title" => title, "url" => url, "extract" => extract,
          "thumbnail_url" => thumbnail_url, "lang" => lang,
          "type" => type, "fetched_at" => fetched_at&.iso8601
        }.compact
      end
    end

    def self.call(term)
      new(term).call
    end

    def initialize(term)
      @term = term.to_s.strip
    end

    def call
      return nil if @term.blank?

      cached = Rails.cache.read(cache_key)
      return cached if cached

      result = fetch
      # 引けなかったことはキャッシュしない。次に開いたときは繋がるかもしれない
      Rails.cache.write(cache_key, result, expires_in: CACHE_TTL) if result
      result
    end

    private

    # 語ごとに1つ。大文字小文字と前後の空白だけ揃える（記事名の正規化は Wikipedia 側に任せる）
    def cache_key
      "wikipedia:summary:ja:#{Digest::SHA256.hexdigest(@term.downcase)}"
    end

    def fetch
      response = connection.get(SUMMARY_PATH + CGI.escape(@term))
      build(response.body)
    rescue Faraday::ResourceNotFound
      # 記事が無いのは異常ではない。「見つからなかった」として静かに返す
      nil
    rescue Faraday::Error, JSON::ParserError => e
      # 落ちている・遅い・返事が読めない。どれもカードの読み書きを止める理由にはならない
      Rails.logger.warn "[Wikipedia] FETCH FAILED term_len=#{@term.length} #{e.class}: #{e.message}"
      nil
    end

    def build(body)
      return nil unless body.is_a?(Hash)
      return nil if body["title"].blank?

      Result.new(
        title: body["title"],
        url: body.dig("content_urls", "desktop", "page"),
        extract: body["extract"].to_s.strip.first(MAX_EXTRACT_LENGTH).presence,
        # 画像は URL だけ持つ。ファイルは保存しない（記事本文とは別のライセンスが付くため）
        thumbnail_url: body.dig("thumbnail", "source"),
        lang: "ja",
        type: body["type"],
        fetched_at: Time.current
      )
    end

    def connection
      @connection ||= Faraday.new(url: BASE_URL) do |f|
        f.response :json
        f.response :raise_error
        f.options.open_timeout = OPEN_TIMEOUT
        f.options.timeout = READ_TIMEOUT
        # Wikimedia の方針に合わせて両方付ける。REST 側は Api-User-Agent も見る
        f.headers["User-Agent"] = self.class.user_agent
        f.headers["Api-User-Agent"] = self.class.user_agent
        f.headers["Accept"] = "application/json"
      end
    end
  end
end
