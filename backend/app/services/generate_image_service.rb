class GenerateImageService
  # 画像生成プロバイダの登録表。モデルを増やすときはここに1行足すだけ。
  PROVIDERS = {
    "openai" => ImageGenerators::Openai,
    "flux" => ImageGenerators::Flux
    # 将来の追加例:
    # "bedrock" => ImageGenerators::Bedrock
  }.freeze

  DEFAULT_PROVIDER = "openai".freeze

  # 利用者が選べるモデル。
  #
  # PROVIDERS が「実装があるか」の表なのに対し、こちらは「選ばせてよいか」の表。
  # 鍵が入っていないものを並べると、選んだ瞬間に失敗する。
  # requires_env が入っている環境でだけ候補に出す。
  #
  # 画質（quality）の段階はここに入れていない。上げると原価が上がるのに
  # 消費クレジットは同じで、粗利だけが減る。値付けを決めてから足すこと。
  CHOICES = [
    {
      key: "openai",
      provider: "openai",
      label: "標準",
      description: "文字や細部が崩れにくく、説明図に向きます。",
      requires_env: "OPENAI_API_KEY"
    },
    {
      key: "flux",
      provider: "flux",
      label: "速い",
      description: "生成が速く、絵画的な表現が得意です。",
      requires_env: "FAL_API_KEY"
    }
  ].freeze

  # 既存キャッシュ（provider を意識せず生成された shared_media）を壊さないための後方互換の既定。
  # この provider/model の組み合わせのときだけ、キャッシュキーに名前空間を付けない。
  LEGACY_PROVIDER = "openai".freeze
  LEGACY_MODEL = "gpt-image-1".freeze

  Result = Struct.new(:image_data, :content_type, :metadata, keyword_init: true)

  def self.call(prompt:, aspect_ratio: AspectRatios::DEFAULT, kind: "unknown", user_id: nil, model_key: nil)
    new.call(prompt:, aspect_ratio:, kind:, user_id:, model_key:)
  end

  # いま選べるモデル。鍵の入っていないものは出さない
  def self.available_choices
    CHOICES.select { |choice| ENV[choice[:requires_env]].present? }
  end

  def self.selectable_key?(key)
    available_choices.any? { |choice| choice[:key] == key.to_s }
  end

  # 全体の既定の provider（カードで選ばれていないときに使う）
  def self.provider_name
    ENV.fetch("IMAGE_GENERATION_PROVIDER", DEFAULT_PROVIDER)
  end

  # カードで選ばれた key を provider 名に直す。
  # 選べない key（鍵が外された・古いカードに残っている）は既定に落とす。
  # 落とさずに失敗させると、鍵を1つ外しただけで過去のカードが作り直せなくなる。
  def self.provider_for(model_key)
    choice = model_key.present? && available_choices.find { |c| c[:key] == model_key.to_s }
    choice ? choice[:provider] : provider_name
  end

  def self.generator_class(model_key = nil)
    name = provider_for(model_key)
    PROVIDERS.fetch(name) do
      raise ArgumentError, "未対応のプロバイダー: #{name}"
    end
  end

  # provider / model の記述子。キャッシュ名前空間・記録に使う。
  def self.descriptor(model_key = nil)
    { provider: provider_for(model_key), model: generator_class(model_key).new.model }
  end

  # キャッシュキーを provider/model で名前空間化する。
  # モデルが増えても「同一プロンプトで別モデル画像が先勝ち共有」されないようにする。
  # 既定(openai/gpt-image-1)は後方互換のため素の normalized をそのまま使う（既存キャッシュ維持）。
  # 縦横比が違えば別画像なので、キーも分ける。
  # 既定（square）は既存キャッシュを活かすため接頭辞を付けない。
  def self.namespaced_cache_key(normalized, aspect_ratio: AspectRatios::DEFAULT, model_key: nil)
    descriptor = descriptor(model_key)
    base =
      if descriptor[:provider] == LEGACY_PROVIDER && descriptor[:model] == LEGACY_MODEL
        normalized
      else
        "#{descriptor[:provider]}:#{descriptor[:model]}:#{normalized}"
      end
    aspect_ratio.to_s == AspectRatios::DEFAULT ? base : "#{aspect_ratio}:#{base}"
  end

  # kind / user_id は原価集計の記録に渡すだけで、生成そのものには影響しない
  def call(prompt:, aspect_ratio: AspectRatios::DEFAULT, kind: "unknown", user_id: nil, model_key: nil)
    result = self.class.generator_class(model_key).new.generate(prompt:, aspect_ratio:, kind:, user_id:)
    Result.new(
      image_data: result[:image_data],
      content_type: result[:content_type],
      metadata: result[:metadata]
    )
  end
end
