# frozen_string_literal: true

# カードの説明（primary_meaning）が事実として正しいかを AI でファクトチェックし、
# 判定（correct / doubtful / incorrect）と意義・質問コメントを Meaning に保存する。
# gpt-4o-mini の Chat Completions（JSON強制）。GenerateMeaningService と同系。
class GenerateFactCheckService
  class GenerationError < StandardError; end

  DEFAULT_MODEL = "gpt-4o-mini"

  SYSTEM_PROMPT = <<~PROMPT.freeze
    あなたは学習カードの説明文を厳密にファクトチェックする校閲者です。
    与えられた「単語/概念」と、その「説明文」について、含まれる事実主張を1つずつ検証してください。

    判定（status）は次の3つから1つ選びます:
      - "correct": 説明が事実として正確で、単語/概念とも一致している場合のみ
      - "doubtful": 一部でも不正確・曖昧・誤解を招く、または確証が持てない場合
      - "incorrect": 明確な誤りを含む、または単語/概念が実在しない・説明と一致しない場合

    重要な原則:
      - 安易に "correct" にしないこと。少しでも不確か・検証できない点があれば "doubtful" 以上にする。
      - その単語/概念が実在しない、一般に知られていない造語、別の用語（例: 似た綴り）との混同が疑われる場合は、
        必ず "doubtful" か "incorrect" にし、その旨を comment に書く。
      - 推測で正しいと判断しない。確証がなければ "doubtful"。

    comment: 学習者向けの短い日本語コメント（誤りの指摘・補足・その概念の意義・考えるとよい質問など）。
    suggestion: status が "doubtful" または "incorrect" のときのみ、事実に基づく簡潔で正確な説明文（訂正案）を日本語で書く。
                判定が "correct" のとき、または適切な訂正が作れないときは空文字 "" にする。

    必ず次の JSON 形式のみで返してください: {"status": "correct|doubtful|incorrect", "comment": "...", "suggestion": "..."}
  PROMPT

  def self.call(item:)
    new(item).call
  end

  def initialize(item)
    @item = item
    @meaning = item.primary_meaning
  end

  # primary_meaning（説明）が無ければ nil を返す（呼び出し側でスキップ扱い）。
  def call
    return nil if @meaning.nil? || @meaning.definition.blank?

    result = request
    @meaning.update!(
      fact_check_status: result[:status],
      fact_check_comment: result[:comment],
      fact_check_suggestion: result[:suggestion],
      fact_checked_at: Time.current
    )
    @meaning
  end

  private

  def user_message
    "単語/概念: #{@item.title}\n説明文: #{@meaning.definition}"
  end

  def request
    client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
    response = client.chat(
      parameters: {
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user_message }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }
    )

    content = response.dig("choices", 0, "message", "content").to_s
    parsed = JSON.parse(content)
    status = parsed["status"].to_s
    raise GenerationError, "不正な判定: #{status}" unless Meaning::FACT_CHECK_STATUSES.include?(status)

    # correct のときは訂正案を持たせない
    suggestion = status == "correct" ? nil : parsed["suggestion"].to_s.strip.presence
    { status:, comment: parsed["comment"].to_s.strip, suggestion: suggestion }
  rescue JSON::ParserError => e
    raise GenerationError, "ファクトチェック結果の解析に失敗しました: #{e.message}"
  end

  def model
    ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL)
  end
end
