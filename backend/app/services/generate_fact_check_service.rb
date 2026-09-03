# frozen_string_literal: true

# カードの内容が事実として正しいかを AI でファクトチェックし、
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
  # カード全体を見るときは、項目のぶんだけ確かめることが増えるので枠を広げる
  MAX_CLAIMS_ALL = 14

  # 何を見るか。
  #   "meaning" … 説明文だけ（既定。速くて安い）
  #   "all"     … 説明文と、書いてある項目すべて
  SCOPES = %w[meaning all].freeze

  # 説明文を指す名前。項目の見出しと同じ並びに置くので、名前を持たせる
  MEANING_FIELD = "説明"
  # 個々の要素ではなく、要素どうしの突き合わせから出た指摘に付ける名前
  CROSS_FIELD = "要素間"

  # 指摘の種類。**同じ「怪しい」でも、直し方が違う**ので分けて持つ。
  #   fact        … 事実として誤っている（世界の側と合わない）
  #   consistency … 要素どうしが食い違っている（カードの中で辻褄が合わない）
  #   intent      … その項目が求めているものと違うことが書いてある
  CLAIM_KINDS = %w[fact consistency intent].freeze

  # 1項目あたり、AI へ渡す文字数の上限。
  # 長文の項目（自由記述）が1つあるだけで、ほかの項目が読まれなくなるのを防ぐ
  MAX_VALUE_CHARS = 400

  def self.system_prompt(scope)
    all = scope == "all"
    # 埋め込む文は先に組み立てる。
    # 式を heredoc の行頭に置くと <<~ の字下げ除去が効かなくなり、
    # 単引用符で囲むと中の #{} がそのまま文字として AI へ渡ってしまう
    sources = all ? "説明文と各項目" : "説明文"
    kind_rule = if all
                  '"fact"（事実の誤り） / "consistency"（要素どうしの食い違い） / "intent"（項目の意図とのずれ）'
    else
                  '"fact" と書く'
    end
    field_rule = if all
                   "与えられた見出し（「#{MEANING_FIELD}」または項目名）をそのまま書く"
    else
                   "「#{MEANING_FIELD}」と書く"
    end
    all_note = if all
                 <<~NOTE
                      **書いてある項目は、ひとつ残らず見ること。** 説明文だけを見て終えない。
                      値が短い項目（分類・年号など）も、その語に対して正しいかを確かめる。

                      さらに、次の2つも確かめる。見落とすと「どれも単体では正しいのに、
                      カードとしては噛み合っていない」状態が素通りする。

                      a. 要素どうしの食い違い（kind="consistency", field="#{CROSS_FIELD}"）
                         例: 説明は「植物の働き」なのに 分野が「物理」
                             説明は「17世紀の人物」なのに 生没年が 1920-1990
                         **一方が正しく他方が誤っているなら、どちらが誤りかを note に書く。**

                      b. 項目の意図とのずれ（kind="intent", field=その項目名）
                         その項目が求めているものと、書いてあるものが違う場合。
                         例: 「分野」に「重要」と書いてある（分野名ではない）
                             「読み方」に意味が書いてある
                         **事実として誤っていなくても指摘する。**
                 NOTE
    else
                 ""
    end

    <<~PROMPT
    あなたは学習カードを厳密にファクトチェックする校閲者です。
    与えられた「単語/概念」と#{sources}について、次の順に考えてください。

    1. known: まず説明文をいったん脇に置き、その「単語/概念」についてあなたが独立に
       確認できることだけを日本語で書く。実在し一般に確立された語かどうかを最初に述べる。
       実在しない・架空・確認できない造語（例: 似た綴りの実在語の取り違え）である場合は、
       その旨を必ずここに書く。知らない場合は「知らない」と正直に書く。推測で埋めない。

    2. claims: #{sources}から事実主張を1つずつ取り出し、1 と突き合わせて検証する。
       最大 #{all ? MAX_CLAIMS_ALL : MAX_CLAIMS} 件。各要素は
         field   … その主張がどこから来たか。#{field_rule}
         kind    … #{kind_rule}
         text    … 取り出した主張（日本語・短く）
         verdict … "supported"（1 で裏づけられる） /
                   "unsupported"（裏づけも否定もできない・確証が持てない） /
                   "contradicted"（1 と矛盾する）
         note    … 一言（不要なら空文字）

    #{all_note}
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
    {"known": "...", "claims": [{"field": "...", "kind": "fact|consistency|intent", "text": "...", "verdict": "supported|unsupported|contradicted", "note": "..."}],
     "status": "correct|doubtful|incorrect", "comment": "...", "suggestion": "...", "title_suggestion": "..."}
    PROMPT
  end

  def self.call(item:, scope: "meaning")
    new(item, scope: scope).call
  end

  def initialize(item, scope: "meaning")
    @item = item
    @meaning = item.primary_meaning
    @scope = SCOPES.include?(scope.to_s) ? scope.to_s : "meaning"
  end

  # primary_meaning（説明）が無ければ nil を返す（呼び出し側でスキップ扱い）。
  def call
    return nil if @meaning.nil? || @meaning.definition.blank?

    result = request
    @meaning.update!(
      fact_check_fields: checked_fields,
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

  def all_scope?
    @scope == "all"
  end

  # 何を見たうえでの判定かを残す。
  #
  # claims からは数えられない。**指摘の出なかった項目は claims に現れない**ので、
  # 「12項目を見て、指摘は2件」の 12 がどこにも残らなくなる。
  def checked_fields
    return [ MEANING_FIELD ] unless all_scope?

    [ MEANING_FIELD ] + property_entries.map(&:first)
  end

  def user_message
    lines = [ "単語/概念: #{@item.title}", "#{MEANING_FIELD}: #{@meaning.definition}" ]
    lines.concat(property_lines) if all_scope?
    lines.join("\n")
  end

  # 書いてある項目を「見出し: 値」で並べる。
  #
  # **空の項目は渡さない。** 「未設定」を送ると、AI がそれ自体を
  # 事実主張として拾い、「情報が不足している」という判定を書いてくる。
  # 見ているのは書いてあることの正しさで、書いていないことではない。
  def property_lines
    property_entries.map { |label, text| "#{label}: #{text}" }
  end

  # 見出しと、読める形にした値の組。
  # **1回だけ数える。** 渡す文と「何を見たか」の両方から使うので、
  # 引き直すと DB を二度なぞることになる
  def property_entries
    @property_entries ||= @item.item_properties.includes(:property_definition).filter_map do |property|
      label = property.property_definition&.label
      next if label.blank? || property.blank_value?
      # 絵は読めない。ここで見るのは文として確かめられるものだけ
      next if property.free_image?

      text = readable_value(property)
      next if text.blank?

      [ label, text.truncate(MAX_VALUE_CHARS) ]
    end
  end

  # 項目の値は型ごとに形が違う。**必ず typed_value を通す**
  # （生の value は {"v" => …} の包みで、そのままでは中身が読めない）
  def readable_value(property)
    value = property.typed_value

    # 読み方は「言語ごとの並び」。そのまま並べるとハッシュの中身が文字として出る
    return reading_text(value) if property.reading?
    # 自由記述は見出しと本文の組
    return [ value["heading"], value["body"] ].map(&:to_s).reject(&:blank?).join(" — ").presence if property.free_text?

    case value
    when true, false then value ? "はい" : "いいえ"
    when Array then value.map(&:to_s).reject(&:blank?).join(" / ").presence
    else value.to_s.presence
    end
  end

  def reading_text(value)
    Array(value).filter_map { |row|
      next unless row.is_a?(Hash)

      text = row["text"].to_s.strip
      next if text.blank?

      "#{row['language']}: #{text}"
    }.join(" / ").presence
  end

  def request
    response = Ai::Chat.call(
      kind: "fact_check",
      user: @item.user,
      model: model,
      messages: [
        { role: "system", content: self.class.system_prompt(@scope) },
        { role: "user", content: user_message }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
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
      # どこから来た主張かを残す。説明だけを見たときは全て説明なので、書かない
      field = claim["field"].to_s.strip
      field = MEANING_FIELD if field.blank?
      # 種類は知らない値を既定へ落とす（画面の出し分けが崩れないように）
      kind = claim["kind"].to_s.strip
      kind = "fact" unless CLAIM_KINDS.include?(kind)
      { "field" => field, "kind" => kind, "text" => text, "verdict" => verdict, "note" => claim["note"].to_s.strip }
    end.first(all_scope? ? MAX_CLAIMS_ALL : MAX_CLAIMS)
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
