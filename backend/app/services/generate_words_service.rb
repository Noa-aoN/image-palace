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
    与えられたテーマ（ジャンル）に沿った、学習に役立つ単語・概念を、指定された条件で重複なく挙げてください。
    テーマが「ランダム」または空の場合は、ジャンルを限定せずあらゆる分野を大きく横断してください
    （科学・数学・歴史・地理・芸術・建築・音楽・映画・スポーツ・食文化・医学・工学・経済・政治・宗教・神話・言語・自然・天文・テクノロジー など、ここに挙げていない分野も含めて幅広く）。
    あまり知られていない用語やマイナーな題材も積極的に織り交ぜ、意外性があり知的好奇心を刺激する、振り幅の大きい語彙を選んでください。
    ただし画像化しやすい具体的な名詞を優先し、抽象的すぎる概念は避けてください（道具・楽器・建造物・乗り物・場所・天体・歴史的遺物・装置・料理・歴史的人物など）。
    動植物に偏りすぎないようにし、専門用語・固有名詞（歴史的人物を含む）・雑学的な題材の比率を高めてください。
    ありきたりな日常語（りんご・犬など）に偏らず、「新しい出会い」になる語を重視してください。
    各要素は短い単語または語句にし、説明文・記号・番号は含めないでください。
    グロテスク・残酷・暴力的・性的・強い不快感を与える題材は避け、安全で健全な語を選んでください。
    どんな場合でも要素数は最大 #{MAX_COUNT} 個までにしてください。
    必ず次の JSON 形式のみで返してください: {"words": ["単語1", "単語2", ...]}
  PROMPT

  def self.call(theme: nil, count: nil)
    new(theme:, count:).call
  end

  # count が nil/空のときは「おまかせ（自動）」。AI がテーマに応じた自然な数を返す。
  # 数値指定時は 1〜MAX_COUNT にクランプ。いずれも MAX_COUNT を超えないよう必ず切り詰める。
  def initialize(theme:, count:)
    @theme = theme.to_s.strip
    @count = count.present? ? count.to_i.clamp(1, MAX_COUNT) : nil
  end

  def call
    request
  end

  private

  # 切り詰めの上限（おまかせ時はハードキャップ＝MAX_COUNT）。
  def cap
    @count || MAX_COUNT
  end

  def user_prompt
    theme = @theme.presence || "ランダム（指定なし）"
    if @count.nil?
      "テーマ: #{theme}\n個数: おまかせ（テーマに最適な数。十二支・曜日・七福神のような有限の集合は過不足なくすべて挙げる。" \
        "それ以外は10〜20程度。ただし最大 #{MAX_COUNT} 個）"
    else
      "テーマ: #{theme}\n個数: #{@count}"
    end
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
    words = Array(parsed["words"]).map { |w| w.to_s.strip }.reject(&:blank?).uniq.first(cap)
    raise GenerationError, "単語を生成できませんでした" if words.empty?

    words
  rescue JSON::ParserError => e
    raise GenerationError, "単語リストの解析に失敗しました: #{e.message}"
  end

  def model
    ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL)
  end
end
