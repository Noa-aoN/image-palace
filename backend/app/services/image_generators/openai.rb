module ImageGenerators
  class Openai < Base
    MODEL = "dall-e-3"
    SIZE = "1024x1024"
    QUALITY = "standard"
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
            model: MODEL,
            prompt: prompt,
            size: SIZE,
            quality: QUALITY,
            n: 1
          }
        )
      end

      url = response.dig("data", 0, "url")
      raise "OpenAI から画像URLを取得できませんでした" if url.blank?

      {
        url:,
        metadata: {
          provider: "openai",
          model: MODEL,
          size: SIZE,
          quality: QUALITY,
          revised_prompt: response.dig("data", 0, "revised_prompt")
        }
      }
    end

    private

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
