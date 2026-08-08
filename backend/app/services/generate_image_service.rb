class GenerateImageService
  # 画像生成プロバイダの登録表。モデルを増やすときはここに1行足すだけ。
  PROVIDERS = {
    "openai" => ImageGenerators::Openai,
    "flux" => ImageGenerators::Flux
    # 将来の追加例:
    # "bedrock" => ImageGenerators::Bedrock
  }.freeze

  DEFAULT_PROVIDER = "openai".freeze

  # 既存キャッシュ（provider を意識せず生成された shared_media）を壊さないための後方互換の既定。
  # この provider/model の組み合わせのときだけ、キャッシュキーに名前空間を付けない。
  LEGACY_PROVIDER = "openai".freeze
  LEGACY_MODEL = "gpt-image-1".freeze

  Result = Struct.new(:image_data, :content_type, :metadata, keyword_init: true)

  def self.call(prompt:, aspect_ratio: AspectRatios::DEFAULT, kind: "unknown", user_id: nil)
    new.call(prompt:, aspect_ratio:, kind:, user_id:)
  end

  # 現在有効な provider 名。
  def self.provider_name
    ENV.fetch("IMAGE_GENERATION_PROVIDER", DEFAULT_PROVIDER)
  end

  def self.generator_class
    PROVIDERS.fetch(provider_name) do
      raise ArgumentError, "未対応のプロバイダー: #{provider_name}"
    end
  end

  # 現在有効な provider / model の記述子。キャッシュ名前空間・記録に使う。
  def self.descriptor
    { provider: provider_name, model: generator_class.new.model }
  end

  # キャッシュキーを provider/model で名前空間化する。
  # モデルが増えても「同一プロンプトで別モデル画像が先勝ち共有」されないようにする。
  # 既定(openai/gpt-image-1)は後方互換のため素の normalized をそのまま使う（既存キャッシュ維持）。
  # 縦横比が違えば別画像なので、キーも分ける。
  # 既定（square）は既存キャッシュを活かすため接頭辞を付けない。
  def self.namespaced_cache_key(normalized, aspect_ratio: AspectRatios::DEFAULT)
    descriptor = self.descriptor
    base =
      if descriptor[:provider] == LEGACY_PROVIDER && descriptor[:model] == LEGACY_MODEL
        normalized
      else
        "#{descriptor[:provider]}:#{descriptor[:model]}:#{normalized}"
      end
    aspect_ratio.to_s == AspectRatios::DEFAULT ? base : "#{aspect_ratio}:#{base}"
  end

  # kind / user_id は原価集計の記録に渡すだけで、生成そのものには影響しない
  def call(prompt:, aspect_ratio: AspectRatios::DEFAULT, kind: "unknown", user_id: nil)
    result = self.class.generator_class.new.generate(prompt:, aspect_ratio:, kind:, user_id:)
    Result.new(
      image_data: result[:image_data],
      content_type: result[:content_type],
      metadata: result[:metadata]
    )
  end
end
