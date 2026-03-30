class GenerateImageService
  PROVIDERS = {
    "openai" => ImageGenerators::Openai
    # 将来の追加例:
    # "stability" => ImageGenerators::Stability
  }.freeze

  Result = Struct.new(:url, :metadata, keyword_init: true)

  def self.call(prompt:)
    new.call(prompt:)
  end

  def call(prompt:)
    provider_name = ENV.fetch("IMAGE_GENERATION_PROVIDER", "openai")
    generator_class = PROVIDERS.fetch(provider_name) do
      raise ArgumentError, "未対応のプロバイダー: #{provider_name}"
    end

    result = generator_class.new.generate(prompt:)
    Result.new(url: result[:url], metadata: result[:metadata])
  end
end
