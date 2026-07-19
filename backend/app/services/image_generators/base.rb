require "open-uri"

module ImageGenerators
  # 画像生成プロバイダの共通基底。
  #
  # 新しいプロバイダを追加するときは、このクラスを継承して以下の2フックだけ実装する:
  #   - #perform_request(prompt:) ... 実際に API を呼び、生レスポンスを返す
  #   - #normalize_response(raw)  ... 生レスポンスを共通形へ正規化して返す
  #       { image_ref: { url: } または { b64: }, content_type:, metadata: {...} }
  # さらに、キャッシュ名前空間・記述子用に #model を公開する。
  #
  # リトライ（一時ネットワーク）・画像データ取得（URL/base64）・タイムアウトは
  # ここで共通化しているので、サブクラスは HTTP と正規化だけに集中できる。
  class Base
    OPEN_TIMEOUT = 10
    READ_TIMEOUT = 60
    MAX_RETRIES = 3
    DEFAULT_CONTENT_TYPE = "image/png".freeze

    # 一時的なネットワーク障害。#with_retry でプロバイダ内リトライする。
    RETRYABLE_ERRORS = [
      EOFError,
      Errno::ECONNRESET,
      Faraday::ConnectionFailed,
      Faraday::SSLError,
      Faraday::TimeoutError,
      Net::ReadTimeout,
      OpenSSL::SSL::SSLError
    ].freeze

    # テンプレートメソッド。共通の骨格を定義し、詳細はサブクラスのフックに委ねる。
    def generate(prompt:)
      raw = with_retry(prompt:) { perform_request(prompt:) }
      normalized = normalize_response(raw)

      {
        image_data: extract_image_data(normalized.fetch(:image_ref)),
        content_type: normalized[:content_type].presence || DEFAULT_CONTENT_TYPE,
        metadata: normalized.fetch(:metadata)
      }
    end

    # 記述子・キャッシュ名前空間で使う。サブクラスで実装必須。
    def model
      raise NotImplementedError, "#{self.class}#model を実装してください"
    end

    private

    # API 呼び出し本体。サブクラスで実装必須。
    def perform_request(prompt:)
      raise NotImplementedError, "#{self.class}#perform_request を実装してください"
    end

    # 生レスポンス → 共通形への正規化。サブクラスで実装必須。
    # @return [Hash] { image_ref: { url: } | { b64: }, content_type:, metadata: }
    def normalize_response(_raw)
      raise NotImplementedError, "#{self.class}#normalize_response を実装してください"
    end

    # URL / base64 のどちらでも画像バイナリを取り出す。
    def extract_image_data(image_ref)
      if image_ref[:b64].present?
        Base64.decode64(image_ref[:b64])
      elsif image_ref[:url].present?
        download(image_ref[:url])
      else
        raise "画像データを取得できませんでした"
      end
    end

    def download(url)
      URI.open(url, open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT, &:read) # rubocop:disable Security/Open
    end

    # 一時的なネットワーク障害のみ、プロバイダ内で指数バックオフ再試行する。
    # 回復しない error（4xx 等）はそのまま伝播させ、ジョブ側の分類に委ねる。
    def with_retry(prompt:)
      attempts = 0

      begin
        yield
      rescue *RETRYABLE_ERRORS => e
        attempts += 1
        raise if attempts > MAX_RETRIES

        prompt_key = Digest::SHA256.hexdigest(prompt)[0, 8]
        Rails.logger.warn(
          "[#{self.class}] retry=#{attempts} prompt_key=#{prompt_key} prompt_len=#{prompt.length} error=#{e.class}: #{e.message}"
        )
        sleep(attempts)
        retry
      end
    end
  end
end
