# frozen_string_literal: true

# カードの説明（primary_meaning）が事実として正しいかを AI でファクトチェックし、
# 判定（correct / doubtful / incorrect）と意義・質問コメントを Meaning に保存する。
#
# 判定を一発で聞くと、もっともらしい説明文に引きずられて "correct" が出やすい。
# そこで手順を踏ませる。
#   1. 説明文を読む前に、その語について独立に確認できることを書き出す（known）
#   2. 説明文から事実主張を1つずつ取り出し、1 と突き合わせる（claims）
#   3. その上で全体の判定を出す
# 生成は前から順に進むため、根拠を先に書かせるほど最後の判定が引きずられにくくなる。
#
# さらに、主張ごとの検証結果と全体判定の食い違いはコード側で正す。
# 「矛盾する主張があるのに correct」のような結論はモデルの気分に任せない。
class GenerateFactCheckService
  class GenerationError < StandardError; end

  # ファクトチェックは世界知識と懐疑性が要るため、既定で意味/タグ生成より強いモデルを使う。
  DEFAULT_MODEL = "gpt-4o"

  # 主張ごとの検証結果
  CLAIM_VERDICTS = %w[supported unsupported contradicted].freeze
  # 説明文が長くても、取り出す主張はこの数までにする（費用と読みやすさのため）
  MAX_CLAIMS = 6

  SYSTEM_PROMPT = <<~PROMPT.freeze
    あなたは学習カードの説明文を厳密にファクトチェックする校閲者です。
    与えられた「単語/概念」と「説明文」について、次の順に考えてください。

    1. known: まず説明文をいったん脇に置き、その「単語/概念」についてあなたが独立に
       確認できることだけを日本語で書く。実在し一般に確立された語かどうかを最初に述べる。
       実在しない・架空・確認できない造語（例: 似た綴りの実在語の取り違え）である場合は、
       その旨を必ずここに書く。知らない場合は「知らない」と正直に書く。推測で埋めない。

    2. claims: 説明文から事実主張を1つずつ取り出し、1 と突き合わせて検証する。
       最大 #{MAX_CLAIMS} 件。各要素は
         text    … 説明文から取り出した主張（日本語・短く）
         verdict … "supported"（1 で裏づけられる） /
                   "unsupported"（裏づけも否定もできない・確証が持てない） /
                   "contradicted"（1 と矛盾する）
         note    … 一言（不要なら空文字）

    3. status: 2 の結果から全体判定を出す。
         "correct"   … 全ての主張が supported で、単語/概念とも一致している場合のみ
         "doubtful"  … unsupported が混じる、曖昧、または確証が持てない
         "incorrect" … contradicted が含まれる、または単語/概念が実在しない・説明と一致しない

    重要な原則:
      - 安易に "correct" にしない。少しでも不確か・検証できない点があれば "doubtful" 以上にする。
      - 説明文がもっともらしく書けていることは、正しさの根拠にならない。
      - 推測で正しいと判断しない。確証がなければ "doubtful"。

    comment: 学習者向けの短い日本語コメント（誤りの指摘・補足・その概念の意義・考えるとよい質問など）。
    suggestion: status が "doubtful" または "incorrect" のときのみ、事実に基づく簡潔で正確な説明文（訂正案）を日本語で書く。
                判定が "correct" のとき、または適切な訂正が作れないときは空文字 "" にする。
    title_suggestion: 「単語名」自体を直すべき場合（実在語の取り違え・誤記など。例: 「トリトニウム」→「トリチウム」）のみ、
                      正しい単語名を書く。単語名を変える必要がなければ空文字 "" にする。

    必ず次の JSON 形式のみで、このキー順で返してください:
    {"known": "...", "claims": [{"text": "...", "verdict": "supported|unsupported|contradicted", "note": "..."}],
     "status": "correct|doubtful|incorrect", "comment": "...", "suggestion": "...", "title_suggestion": "..."}
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
      fact_check_title_suggestion: result[:title_suggestion],
      fact_check_known: result[:known],
      fact_check_claims: result[:claims],
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

    parse(response.dig("choices", 0, "message", "content").to_s)
  end

  def parse(content)
    parsed = JSON.parse(content)
    claims = normalize_claims(parsed["claims"])
    status = reconcile_status(parsed["status"].to_s, claims)

    # correct のときは訂正案（説明・単語名）を持たせない。
    # 単語名の訂正案は、現在の単語名と同じなら無視する。
    suggestion = status == "correct" ? nil : parsed["suggestion"].to_s.strip.presence
    title_suggestion = status == "correct" ? nil : parsed["title_suggestion"].to_s.strip.presence
    title_suggestion = nil if title_suggestion == @item.title

    {
      status:, suggestion:, title_suggestion:, claims:,
      comment: parsed["comment"].to_s.strip,
      known: parsed["known"].to_s.strip.presence
    }
  rescue JSON::ParserError => e
    raise GenerationError, "ファクトチェック結果の解析に失敗しました: #{e.message}"
  end

  def normalize_claims(raw)
    Array(raw).filter_map do |claim|
      next unless claim.is_a?(Hash)

      text = claim["text"].to_s.strip
      next if text.blank?

      verdict = claim["verdict"].to_s.strip
      verdict = "unsupported" unless CLAIM_VERDICTS.include?(verdict)
      { "text" => text, "verdict" => verdict, "note" => claim["note"].to_s.strip }
    end.first(MAX_CLAIMS)
  end

  # 主張ごとの検証結果と全体判定が食い違ったら、厳しい側へ寄せる。
  # もっともらしい説明文に引きずられて甘い判定が出るのを、コード側で止める。
  def reconcile_status(status, claims)
    raise GenerationError, "不正な判定: #{status}" unless Meaning::FACT_CHECK_STATUSES.include?(status)
    return status if claims.empty?

    verdicts = claims.map { |claim| claim["verdict"] }
    return "incorrect" if verdicts.include?("contradicted") && status == "correct"
    return "doubtful" if verdicts.include?("unsupported") && status == "correct"

    status
  end

  def model
    # 意味/タグ生成（OPENAI_TEXT_MODEL=mini）とは別に、ファクトチェック専用モデルを使う。
    ENV.fetch("OPENAI_FACT_CHECK_MODEL", DEFAULT_MODEL)
  end
end
