# frozen_string_literal: true

# テーマ/ジャンルから学習用の単語リストを OpenAI Chat API で生成する。
# ワードリスト作成（words#generate）とアクロポリス（ガチャ）で共有する。
# GenerateMeaningService と同じく gpt-4o-mini の Chat Completions（JSON強制）を使う。
class GenerateWordsService
  class GenerationError < StandardError; end

  DEFAULT_MODEL = "gpt-4o-mini"
  MAX_COUNT = 50
  # 除外/回避リストの上限（プロンプト肥大化・トークンコスト抑制）。
  EXCLUDE_LIMIT = 300

  # 語彙の難しさ。学ぶ人の段階に合わせて振れ幅を変える。
  # 「難しい」ほど、耳慣れない語・専門の語・出会いにくい語を多くする。
  DIFFICULTIES = %w[easy normal hard expert].freeze
  DEFAULT_DIFFICULTY = "normal"

  DIFFICULTY_GUIDES = {
    "easy" => "小学生でも知っている、身近で目に見えるものを中心にしてください。" \
              "専門用語や固有名詞は避け、日常で出会う具体物・生き物・道具・食べ物などから選びます。",
    "normal" => "中学〜高校で出会う程度の一般教養レベルにしてください。" \
                "誰もが知っているとは限らないが、説明されれば分かる語を中心にします。",
    "hard" => "大学の教養課程〜専門入門で出会う程度にしてください。" \
              "分野の専門用語、歴史上の事物、あまり知られていない固有名詞を多く含めます。",
    "expert" => "その分野を学んだ人でなければ知らない水準にしてください。" \
                "専門用語・古典的な術語・地域や時代の限られた事物・希少な固有名詞を積極的に選びます。" \
                "ただし実在し、調べれば確かめられるものに限ります。"
  }.freeze

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

  # exclude: 絶対に出さない語（既出＝受け取り済み）。avoid: 出す確率を大きく下げる語（キャンセル済み）。
  # difficulty: 語彙の難しさ（easy / normal / hard / expert）。
  def self.call(theme: nil, count: nil, exclude: [], avoid: [], difficulty: nil, user: nil)
    new(theme:, count:, exclude:, avoid:, difficulty:, user:).call
  end

  def self.normalize_difficulty(value)
    DIFFICULTIES.include?(value.to_s) ? value.to_s : DEFAULT_DIFFICULTY
  end

  # count が nil/空のときは「おまかせ（自動）」。AI がテーマに応じた自然な数を返す。
  # 数値指定時は 1〜MAX_COUNT にクランプ。いずれも MAX_COUNT を超えないよう必ず切り詰める。
  def initialize(theme:, count:, exclude: [], avoid: [], difficulty: nil, user: nil)
    @user = user
    @difficulty = self.class.normalize_difficulty(difficulty)
    @theme = theme.to_s.strip
    @count = count.present? ? count.to_i.clamp(1, MAX_COUNT) : nil
    @exclude = clean_list(exclude)
    @avoid = clean_list(avoid) - @exclude
  end

  def call
    request
  end

  private

  # 切り詰めの上限（おまかせ時はハードキャップ＝MAX_COUNT）。
  def cap
    @count || MAX_COUNT
  end

  # 難しさの指示を末尾に足す。同じ土台に一段だけ条件を重ねる形にして、
  # 指示同士が打ち消し合わないようにする。
  def system_prompt
    "#{SYSTEM_PROMPT}\n難しさの指定: #{DIFFICULTY_GUIDES.fetch(@difficulty)}"
  end

  def user_prompt
    theme = @theme.presence || "ランダム（指定なし）"
    count_line =
      if @count.nil?
        "個数: おまかせ（テーマに最適な数。十二支・曜日・七福神のような有限の集合は過不足なくすべて挙げる。" \
          "それ以外は10〜20程度。ただし最大 #{MAX_COUNT} 個）"
      else
        "個数: #{@count}"
      end
    [ "テーマ: #{theme}", count_line, exclusion_instructions ].reject(&:blank?).join("\n")
  end

  # 既出（除外）・キャンセル（回避）の語をプロンプトに反映する。
  def exclusion_instructions
    lines = []
    lines << "次の語は既出のため絶対に出さないでください: #{@exclude.join('、')}" if @exclude.any?
    lines << "次の語はできるだけ避け、出す確率を大きく下げてください: #{@avoid.join('、')}" if @avoid.any?
    lines.join("\n")
  end

  def clean_list(list)
    Array(list).map { |w| w.to_s.strip }.reject(&:blank?).uniq.first(EXCLUDE_LIMIT)
  end

  def request
    response = Ai::Chat.call(
      kind: "words_generate",
      user: @user,
      model: model,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt }
      ],
      temperature: 0.9,
      response_format: { type: "json_object" }
    )

    content = response.dig("choices", 0, "message", "content").to_s
    parsed = JSON.parse(content)
    words = Array(parsed["words"]).map { |w| w.to_s.strip }.reject(&:blank?).uniq
    words -= @exclude # 既出（受け取り済み）は確実に除外する
    words = words.first(cap)
    raise GenerationError, "単語を生成できませんでした" if words.empty?

    words
  rescue JSON::ParserError => e
    raise GenerationError, "単語リストの解析に失敗しました: #{e.message}"
  end

  def model
    ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL)
  end
end
