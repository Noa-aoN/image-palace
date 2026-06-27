# frozen_string_literal: true

# テーマ/ジャンルから学習用の単語リストを OpenAI Chat API で生成する。
# ワードリスト作成（words#generate）とデルフォイ（ガチャ）で共有する。
# GenerateMeaningService と同じく gpt-4o-mini の Chat Completions（JSON強制）を使う。
class GenerateWordsService
  class GenerationError < StandardError; end

  DEFAULT_MODEL = "gpt-4o-mini"
  MAX_COUNT = 50

  SYSTEM_PROMPT = <<~PROMPT.freeze
    あなたは学習用の単語リスト作成アシスタントです。
    与えられたテーマ（ジャンル）に沿った、学習に役立つ単語・概念を、指定された個数だけ重複なく挙げてください。
    テーマが「ランダム」または空の場合は、一般教養・学習に役立つ単語を幅広いジャンルからランダムに選んでください。
    各要素は短い単語または語句にし、説明文・記号・番号は含めないでください。
    必ず次の JSON 形式のみで返してください: {"words": ["単語1", "単語2", ...]}
  PROMPT

  def self.call(theme: nil, count: 5)
    new(theme:, count:).call
  end

  def initialize(theme:, count:)
    @theme = theme.to_s.strip
    @count = count.to_i.clamp(1, MAX_COUNT)
  end

  def call
    request
  end

  private

  def user_prompt
    theme = @theme.presence || "ランダム（指定なし）"
    "テーマ: #{theme}\n個数: #{@count}"
  end

  def request
    client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
    response = client.chat(
      parameters: {
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user_prompt }
        ],
        temperature: 0.9,
        response_format: { type: "json_object" }
      }
    )

    content = response.dig("choices", 0, "message", "content").to_s
    parsed = JSON.parse(content)
    words = Array(parsed["words"]).map { |w| w.to_s.strip }.reject(&:blank?).uniq.first(@count)
    raise GenerationError, "単語を生成できませんでした" if words.empty?

    words
  rescue JSON::ParserError => e
    raise GenerationError, "単語リストの解析に失敗しました: #{e.message}"
  end

  def model
    ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL)
  end
end
