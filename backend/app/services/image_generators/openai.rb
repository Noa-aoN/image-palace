module ImageGenerators
  class Openai < Base
    # 現行モデルは gpt-image-1（dall-e-3 は廃止/利用不可になり 400 を返す）。
    # 環境変数で上書き可能にしておく（モデル/品質の入れ替えに備える）。
    DEFAULT_MODEL = "gpt-image-1"
    SIZE = "1024x1024"
    # gpt-image-1 の quality は low / medium / high / auto
    DEFAULT_QUALITY = "medium"

    def model
      ENV.fetch("OPENAI_IMAGE_MODEL", DEFAULT_MODEL)
    end

    private

    def perform_request(prompt:)
      client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
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

    def normalize_response(response)
      data = response.dig("data", 0) || {}

      {
        # gpt-image-1 は base64（b64_json）で返す。url を返すモデルにも両対応する。
        image_ref: { b64: data["b64_json"], url: data["url"] },
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

    def quality
      ENV.fetch("OPENAI_IMAGE_QUALITY", DEFAULT_QUALITY)
    end
  end
end
