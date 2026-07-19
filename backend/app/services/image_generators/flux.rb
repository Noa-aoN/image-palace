module ImageGenerators
  # FLUX 画像生成（fal.ai 経由）。
  # 同期エンドポイント https://fal.run/<model> に POST し、結果 JSON を受け取る。
  # レスポンスの画像は URL のみ返るため、Base#download で取得する。
  #
  # 追加に必要なのはこのクラスと GenerateImageService::PROVIDERS への1行だけ。
  # リトライ・URL ダウンロード・タイムアウトは Base 側で共通化済み。
  class Flux < Base
    DEFAULT_MODEL = "fal-ai/flux/schnell"
    DEFAULT_IMAGE_SIZE = "square_hd" # 1024x1024
    OUTPUT_FORMAT = "png"            # OpenAI(png) と揃える（既定は jpeg）
    BASE_URL = "https://fal.run".freeze

    def model
      ENV.fetch("FAL_IMAGE_MODEL", DEFAULT_MODEL)
    end

    private

    def perform_request(prompt:)
      response = connection.post(model) do |req|
        req.body = {
          prompt: prompt,
          image_size: image_size,
          num_images: 1,
          output_format: OUTPUT_FORMAT
        }
      end
      response.body
    end

    def normalize_response(body)
      image = Array(body["images"]).first || {}

      {
        image_ref: { url: image["url"] },
        content_type: image["content_type"].presence || DEFAULT_CONTENT_TYPE,
        metadata: {
          provider: "flux",
          model: model,
          size: image_size,
          seed: body["seed"]
        }
      }
    end

    def image_size
      ENV.fetch("FAL_IMAGE_SIZE", DEFAULT_IMAGE_SIZE)
    end

    def connection
      @connection ||= Faraday.new(url: BASE_URL) do |f|
        f.request :json
        f.response :json
        f.response :raise_error # 4xx/5xx を Faraday::*Error に変換（ジョブ側の分類と整合）
        f.options.open_timeout = OPEN_TIMEOUT
        f.options.timeout = READ_TIMEOUT
        f.headers["Authorization"] = "Key #{ENV.fetch('FAL_API_KEY')}"
      end
    end
  end
end
