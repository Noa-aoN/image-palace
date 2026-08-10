class GenerateImageService
  # 画像生成プロバイダの登録表。モデルを増やすときはここに1行足すだけ。
  PROVIDERS = {
    "openai" => ImageGenerators::Openai,
    "flux" => ImageGenerators::Flux
    # 将来の追加例:
    # "bedrock" => ImageGenerators::Bedrock
  }.freeze

  DEFAULT_PROVIDER = "openai".freeze

  # 選べるモデルは登録簿（AiModel）が持つ。
  #
  # 以前はここに定数で並べていたが、原価・消費クレジット・表示名が別々の場所にあり、
  # 「1枚いくらで、いくら貰っていて、誰に見せているか」を一度に見られなかった。
  # PROVIDERS が「実装があるか」の表、AiModel が「どう使うか」の表という分担にしている。

  # 既存キャッシュ（provider を意識せず生成された shared_media）を壊さないための後方互換の既定。
  # この provider/model の組み合わせのときだけ、キャッシュキーに名前空間を付けない。
  LEGACY_PROVIDER = "openai".freeze
  LEGACY_MODEL = "gpt-image-1".freeze

  Result = Struct.new(:image_data, :content_type, :metadata, keyword_init: true)

  def self.call(prompt:, aspect_ratio: AspectRatios::DEFAULT, kind: "unknown", user_id: nil, model_key: nil,
                options: {})
    new.call(prompt:, aspect_ratio:, kind:, user_id:, model_key:, options:)
  end

  # いま選べるモデル。鍵の入っていないもの・止めているもの・隠しているものは出さない。
  # purpose を渡すと、その用途に使ってよいものだけに絞る
  def self.available_choices(purpose: nil)
    AiModel.registry
           .select { |m| m.kind == "image" && m.selectable? }
           .select { |m| purpose.nil? || m.serves?(purpose) }
  end

  def self.selectable_key?(key)
    available_choices.any? { |m| m.key == key.to_s }
  end

  # 全体の既定の provider（カードで選ばれていないときに使う）。
  #
  # 環境変数が最優先。障害時に「とにかくこちらへ倒す」を、画面を通さずにできる道を残す。
  # 次に登録簿の既定、最後にコードの既定。
  def self.provider_name
    from_env = ENV["IMAGE_GENERATION_PROVIDER"]
    return from_env if from_env.present?

    default_model&.provider || DEFAULT_PROVIDER
  end

  def self.default_model
    AiModel.registry.find { |m| m.kind == "image" && m.default_for_kind? && m.available? }
  end

  # カードで選ばれた key を provider 名に直す。
  # 選べない key（鍵が外された・古いカードに残っている）は既定に落とす。
  # 落とさずに失敗させると、鍵を1つ外しただけで過去のカードが作り直せなくなる。
  def self.provider_for(model_key)
    model = model_key.present? && available_choices.find { |m| m.key == model_key.to_s }
    model ? model.provider : provider_name
  end

  # 実際に使う key を決める。
  #
  # 用途から外れている・1日の上限に達している場合は既定に落とす。
  # ここで失敗させると、上限に当たった瞬間に絵が作れなくなる。
  # 落とす先の既定にも上限を掛けたいときは、既定側に上限を設定すること。
  def self.usable_key(model_key, purpose: nil)
    return nil if model_key.blank?

    model = available_choices.find { |m| m.key == model_key.to_s }
    return nil if model.nil?
    return nil if purpose.present? && !model.serves?(purpose)

    if model.daily_limit_reached?
      Rails.logger.warn "[GenerateImageService] DAILY LIMIT model=#{model.key} limit=#{model.daily_limit}"
      return nil
    end

    model.key
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

  # kind は原価集計の記録に使うほか、モデルの用途の判定にも使う。
  # user_id は記録だけ
  def call(prompt:, aspect_ratio: AspectRatios::DEFAULT, kind: "unknown", user_id: nil, model_key: nil,
           options: {})
    key = self.class.usable_key(model_key, purpose: kind)
    result = self.class.generator_class(key).new.generate(prompt:, aspect_ratio:, kind:, user_id:, options:)
    Result.new(
      image_data: result[:image_data],
      content_type: result[:content_type],
      metadata: result[:metadata]
    )
  end
end
