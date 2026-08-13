# frozen_string_literal: true

# アイテム（単語・概念）の意味・説明を OpenAI Chat API で生成し、日本語の Meaning として保存する。
# 個別生成（詳細画面のボタン）と作成時の自動生成の両方から利用する。
class GenerateMeaningService
  class GenerationError < StandardError; end

  DEFAULT_MODEL = "gpt-4o-mini"
  LANGUAGE_CODE = "ja"

  # 詳しさレベル別の指示。共通の JSON 形式指示（COMMON_PROMPT）を併せて使う。
  LEVEL_INSTRUCTIONS = {
    "brief" => "与えられた単語・概念を、日本語でひとことで（40字以内）、定義のみ簡潔に説明してください。example_sentence は空文字列にしてください。",
    "simple" => "与えられた単語・概念を、日本語で簡潔（80〜120字程度）に説明し、理解を助ける短い例文を添えてください。",
    "detailed" => "与えられた単語・概念を、日本語でくわしく（200〜300字程度）、背景・要点・補足も含めて説明し、理解を助ける例文を添えてください。"
  }.freeze

  COMMON_PROMPT = <<~PROMPT.freeze
    あなたは学習者向けの辞書アシスタントです。専門的になりすぎず、初学者にも伝わる言葉を使ってください。
    必ず次の JSON 形式のみで返してください: {"definition": "意味の説明", "example_sentence": "短い例文や用例"}
    example_sentence は理解を助ける短い例文・用例。不要な場合は空文字列にしてください。
  PROMPT

  def self.call(item:, level: Meaning::DEFAULT_DETAIL_LEVEL)
    new(item, level).call
  end

  def initialize(item, level = Meaning::DEFAULT_DETAIL_LEVEL)
    @item = item
    @level = Meaning.normalize_level(level)
  end

  # 生成した意味を Meaning(ja) として upsert し、その Meaning を返す
  def call
    result = request
    meaning = @item.meanings.find_or_initialize_by(language_code: LANGUAGE_CODE)
    meaning.update!(
      definition: result.fetch(:definition),
      example_sentence: result[:example_sentence],
      detail_level: @level
    )
    meaning
  end

  private

  def system_prompt
    "#{LEVEL_INSTRUCTIONS.fetch(@level)}\n#{COMMON_PROMPT}"
  end

  def request
    response = Ai::Chat.call(
      kind: "meaning",
      user: @item.user,
      model: model,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_message }
      ],
      temperature: 0.4,
      response_format: { type: "json_object" }
    )

    content = response.dig("choices", 0, "message", "content").to_s
    parsed = JSON.parse(content)
    definition = parsed["definition"].to_s.strip
    raise GenerationError, "意味を生成できませんでした" if definition.blank?

    { definition: definition, example_sentence: parsed["example_sentence"].to_s.strip.presence }
  rescue JSON::ParserError => e
    raise GenerationError, "意味の解析に失敗しました: #{e.message}"
  end

  # 調べた結果があれば、それを下敷きにする。
  #
  # **写させない。** 引き写すと、出どころの分からない文がカードに残る
  # （Wikipedia の文には条件が付く）。読んで、この製品の言葉で書き直させる。
  # 下敷きがあるぶん、作り話が混ざりにくくもなる。
  def user_message
    return @item.title if wikipedia_extract.blank?

    <<~TEXT
      <単語>
      #{@item.title}

      <調べた結果>
      #{wikipedia_extract}

      調べた結果は**参考**です。そのまま書き写さず、自分の言葉で短く書き直してください。
      書かれていないことを足さないでください。
    TEXT
  end

  # Wikipedia の項目に入っている冒頭。持っていなければ nil
  def wikipedia_extract
    return @wikipedia_extract if defined?(@wikipedia_extract)

    row = @item.item_properties.includes(:property_definition)
               .find { |p| p.property_definition&.value_type == "wikipedia" }
    parsed = row && (JSON.parse(row.typed_value.to_s) rescue nil)
    @wikipedia_extract = parsed.is_a?(Hash) ? parsed["wikipedia_extract"].to_s.strip.presence : nil
  end

  def model
    ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL)
  end
end
