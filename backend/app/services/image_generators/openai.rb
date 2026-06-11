module ImageGenerators
  class Openai < Base
    # 現行モデルは gpt-image-1（dall-e-3 は廃止/利用不可になり 400 を返す）。
    # 環境変数で上書き可能にしておく（モデル/品質の入れ替えに備える）。
    DEFAULT_MODEL = "gpt-image-1"
    SIZE = "1024x1024"
    # gpt-image-1 の quality は low / medium / high / auto
    DEFAULT_QUALITY = "medium"
    OPEN_TIMEOUT = 10
    READ_TIMEOUT = 60
    MAX_RETRIES = 3
    RETRYABLE_ERRORS = [
      EOFError,
      Errno::ECONNRESET,
      Faraday::ConnectionFailed,
      Faraday::SSLError,
      Faraday::TimeoutError,
      Net::ReadTimeout,
      OpenSSL::SSL::SSLError
    ].freeze

    def generate(prompt:)
      client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
      response = with_retry(prompt:) do
        client.images.generate(
          parameters: {
            model: model,
            prompt: prompt,
            size: SIZE,
            quality: quality,
            n: 1
          }
        )
      end

      data = response.dig("data", 0) || {}

      {
        image_data: extract_image_data(data),
        content_type: "image/png",
        metadata: {
          provider: "openai",
          model: model,
          size: SIZE,
          quality: quality,
          revised_prompt: data["revised_prompt"]
        }
      }
    end

    private

    def model
      ENV.fetch("OPENAI_IMAGE_MODEL", DEFAULT_MODEL)
    end

    def quality
      ENV.fetch("OPENAI_IMAGE_QUALITY", DEFAULT_QUALITY)
    end

    # gpt-image-1 は base64（b64_json）で返す。url を返すモデルにも両対応する。
    def extract_image_data(data)
      if data["b64_json"].present?
        Base64.decode64(data["b64_json"])
      elsif data["url"].present?
        download(data["url"])
      else
        raise "OpenAI から画像データを取得できませんでした"
      end
    end

    def download(url)
      require "open-uri"
      URI.open(url, open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT, &:read) # rubocop:disable Security/Open
    end

    def with_retry(prompt:)
      attempts = 0

      begin
        yield
      rescue *RETRYABLE_ERRORS => e
        attempts += 1
        raise if attempts > MAX_RETRIES

        Rails.logger.warn(
          "[ImageGenerators::Openai] retry=#{attempts} prompt=#{prompt} error=#{e.class}: #{e.message}"
        )
        sleep(attempts)
        retry
      end
    end
  end
end
