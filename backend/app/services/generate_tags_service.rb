# frozen_string_literal: true

# アイテム（単語・概念）に対し、分類用のタグを OpenAI Chat API で生成して付与する。
# 個別生成（詳細画面のボタン）と作成時の自動生成の両方から利用する。
# 既存タグは消さず union で追加し、可能な限りユーザーの既存タグを再利用させる。
class GenerateTagsService
  class GenerationError < StandardError; end

  DEFAULT_MODEL = "gpt-4o-mini"
  MAX_TAGS = 5
  EXISTING_TAGS_LIMIT = 50

  SYSTEM_PROMPT = <<~PROMPT.freeze
    あなたは学習カードの整理を助けるアシスタントです。与えられた単語・概念に対して、
    分類・検索に役立つ日本語のタグを3〜5個提案してください。
    - 抽象度は中程度（「英語」「生物学」「ネットワーク」など学習テーマ単位）。
    - 固有名詞そのものや文章、記号は避ける。
    - 「既存のタグ」が与えられた場合は、意味が合うものを優先的に再利用する。
    必ず次の JSON 形式のみで返してください: {"tags": ["タグ1", "タグ2"]}
  PROMPT

  def self.call(item:)
    new(item).call
  end

  def initialize(item)
    @item = item
  end

  # 生成したタグを既存タグへ union で追加し、対象アイテムを返す
  def call
    names = normalize(request)
    return @item if names.empty?

    new_tags = names.map { |name| find_or_create_tag(name) }
    @item.tags = (@item.tags + new_tags).uniq
    @item
  end

  private

  def request
    client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
    response = client.chat(
      parameters: {
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user_message }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }
    )

    content = response.dig("choices", 0, "message", "content").to_s
    parsed = JSON.parse(content)
    tags = parsed["tags"]
    raise GenerationError, "タグを生成できませんでした" unless tags.is_a?(Array)

    tags
  rescue JSON::ParserError => e
    raise GenerationError, "タグの解析に失敗しました: #{e.message}"
  end

  def user_message
    existing = @item.user.tags.ordered.limit(EXISTING_TAGS_LIMIT).pluck(:name)
    message = "単語・概念: #{@item.title}"
    message += "\n既存のタグ: #{existing.join(', ')}" if existing.any?
    message
  end

  # 既存タグは大文字小文字を無視して再利用し、無ければ新規作成する。
  # （Tag の uniqueness は case_insensitive のため、素朴な find_or_create_by だと衝突しうる）
  def find_or_create_tag(name)
    @item.user.tags.where("LOWER(name) = ?", name.downcase).first ||
      @item.user.tags.create!(name: name)
  end

  # 文字列化・トリム・空除去・長さ超過除外・大文字小文字無視の重複排除・上限件数
  def normalize(raw_tags)
    raw_tags
      .map { |t| t.to_s.strip }
      .reject(&:blank?)
      .select { |t| t.length <= Tag::NAME_MAX_LENGTH }
      .uniq(&:downcase)
      .first(MAX_TAGS)
  end

  def model
    ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL)
  end
end
