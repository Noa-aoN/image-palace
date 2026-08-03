# frozen_string_literal: true

# ワードリストの単語が、指定テーマに沿っているかを AI で点検する。
# 各単語の判定（ok / off_theme / duplicate / inappropriate / typo）と訂正案、
# テーマに欠けている単語の追加提案を返す。
# GenerateFactCheckService と同系（Chat Completions・JSON強制）。テキストのみ＝クレジット消費なし。
class CheckWordsService
  class GenerationError < StandardError; end

  # 判断力が要るため、単語生成（mini）ではなくファクトチェックと同じ強めのモデルを使う。
  DEFAULT_MODEL = "gpt-4o"

  # 点検できる単語数の上限（プロンプト肥大化・トークンコスト抑制）。
  MAX_WORDS = 200
  # 追加提案の上限。
  MAX_ADDITIONS = 10

  VERDICTS = %w[ok off_theme duplicate inappropriate typo].freeze

  SYSTEM_PROMPT = <<~PROMPT.freeze
    あなたは学習用ワードリストの校閲者です。
    与えられた「テーマ」と「単語リスト」について、各単語がテーマに沿った学習素材として適切かを点検してください。

    各単語に次のいずれかの判定（verdict）を付けます:
      - "ok": テーマに沿っており、そのままで問題ない
      - "off_theme": テーマから外れている（別分野の語、関係のない語）
      - "duplicate": リスト内の他の語と実質的に重複している（表記ゆれ・言い換えを含む）
      - "inappropriate": グロテスク・残酷・暴力的・性的など、学習素材にふさわしくない
      - "typo": 誤記・誤変換・実在しない綴り（例:「トリトニウム」→「トリチウム」）

    reason: なぜその判定なのかを、学習者向けの短い日本語で書く（"ok" のときは空文字 "" にする）。
    replacement: その語を「置き換えるべき正しい語」がある場合のみ書く（typo の訂正、テーマに沿った近い語への差し替え）。
                 置き換え案が作れない、または削除すべき場合は空文字 "" にする。

    additions: テーマに対してリストに欠けている、加えると学習価値が高い単語を最大 #{MAX_ADDITIONS} 個まで挙げる。
               既にリストにある語は含めないこと。欠けている語が思い当たらなければ空配列にする。
               画像化しやすい具体的な名詞を優先し、安全で健全な語を選ぶこと。

    テーマが空の場合は、リスト全体から共通するテーマを推測して点検してください。

    必ず次の JSON 形式のみで返してください:
    {"issues": [{"word": "...", "verdict": "ok|off_theme|duplicate|inappropriate|typo", "reason": "...", "replacement": "..."}],
     "additions": ["...", "..."]}
  PROMPT

  Result = Struct.new(:issues, :additions, keyword_init: true)

  def self.call(theme:, words:, user: nil)
    new(theme:, words:, user:).call
  end

  def initialize(theme:, words:, user: nil)
    @user = user
    @theme = theme.to_s.strip
    @words = Array(words).map { |w| w.to_s.strip }.reject(&:blank?).uniq.first(MAX_WORDS)
  end

  def call
    raise GenerationError, "点検する単語がありません" if @words.empty?

    request
  end

  private

  def user_prompt
    theme = @theme.presence || "指定なし（リストから推測すること）"
    [ "テーマ: #{theme}", "単語リスト:", @words.map { |w| "- #{w}" }.join("\n") ].join("\n")
  end

  def request
    response = Ai::Chat.call(
      kind: "words_check",
      user: @user,
      model: model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user_prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    )

    content = response.dig("choices", 0, "message", "content").to_s
    parsed = JSON.parse(content)
    Result.new(issues: build_issues(parsed["issues"]), additions: build_additions(parsed["additions"]))
  rescue JSON::ParserError => e
    raise GenerationError, "点検結果の解析に失敗しました: #{e.message}"
  end

  # 送っていない単語・未知の判定は捨てる。ok は指摘ではないので返さない。
  def build_issues(issues)
    Array(issues).filter_map do |issue|
      word = issue["word"].to_s.strip
      verdict = issue["verdict"].to_s
      next unless @words.include?(word)
      next unless VERDICTS.include?(verdict)
      next if verdict == "ok"

      # 元の語と同じ置換案は無意味なので落とす（GenerateFactCheckService の title_suggestion と同じ扱い）。
      replacement = issue["replacement"].to_s.strip.presence
      replacement = nil if replacement == word

      { word:, verdict:, reason: issue["reason"].to_s.strip, replacement: }
    end.uniq { |issue| issue[:word] }
  end

  # 既にリストにある語は提案しない。
  def build_additions(additions)
    Array(additions)
      .map { |w| w.to_s.strip }
      .reject(&:blank?)
      .uniq
      .reject { |w| @words.include?(w) }
      .first(MAX_ADDITIONS)
  end

  def model
    # 単語生成（OPENAI_TEXT_MODEL=mini）とは別に、点検はファクトチェックと同じモデルを使う。
    ENV.fetch("OPENAI_FACT_CHECK_MODEL", DEFAULT_MODEL)
  end
end
