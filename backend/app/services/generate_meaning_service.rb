# frozen_string_literal: true

# アイテム（単語・概念）の意味・説明を OpenAI Chat API で生成し、日本語の Meaning として保存する。
# 個別生成（詳細画面のボタン）と作成時の自動生成の両方から利用する。
class GenerateMeaningService
  class GenerationError < StandardError; end

  DEFAULT_MODEL = "gpt-4o-mini"
  LANGUAGE_CODE = "ja"

  SYSTEM_PROMPT = <<~PROMPT.freeze
    あなたは学習者向けの辞書アシスタントです。与えられた単語・概念について、日本語で
    簡潔（80〜120字程度）に意味・説明を作成してください。専門的になりすぎず、初学者にも
    伝わる言葉を使ってください。
    必ず次の JSON 形式のみで返してください: {"definition": "意味の説明", "example_sentence": "短い例文や用例"}
    example_sentence は理解を助ける短い例文・用例。不要な場合は空文字列にしてください。
  PROMPT

  def self.call(item:)
    new(item).call
  end

  def initialize(item)
    @item = item
  end

  # 生成した意味を Meaning(ja) として upsert し、その Meaning を返す
  def call
    result = request
    meaning = @item.meanings.find_or_initialize_by(language_code: LANGUAGE_CODE)
    meaning.update!(
      definition: result.fetch(:definition),
      example_sentence: result[:example_sentence]
    )
    meaning
  end

  private

  def request
    client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
    response = client.chat(
      parameters: {
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: @item.title }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      }
    )

    content = response.dig("choices", 0, "message", "content").to_s
    parsed = JSON.parse(content)
    definition = parsed["definition"].to_s.strip
    raise GenerationError, "意味を生成できませんでした" if definition.blank?

    { definition: definition, example_sentence: parsed["example_sentence"].to_s.strip.presence }
  rescue JSON::ParserError => e
    raise GenerationError, "意味の解析に失敗しました: #{e.message}"
  end

  def model
    ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL)
  end
end
