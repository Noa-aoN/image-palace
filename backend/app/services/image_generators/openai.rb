module ImageGenerators
  class Openai < Base
    MODEL = "dall-e-3"
    SIZE = "1024x1024"
    QUALITY = "standard"

    def generate(prompt:)
      client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))

      response = client.images.generate(
        parameters: {
          model: MODEL,
          prompt: prompt,
          size: SIZE,
          quality: QUALITY,
          n: 1
        }
      )

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
  end
end
