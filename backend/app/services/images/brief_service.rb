# frozen_string_literal: true

module Images
  # 単語を「一枚の絵にできる情景」へ翻訳する。
  #
  # これまでは単語をそのまま画像生成に渡していた。りんごや消防車のような
  # 目に見えるものはそれで十分だが、「機会費用」「懐かしさ」のような概念語は
  # 絵にしようがなく、生成側が適当な図解や文字を描いてしまっていた。
  #
  # そこで一度ことばで噛み砕く。
  #   ① description  … その語が何かを、絵の手がかりになる密度で書いた説明文
  #   ② scene_prompt … ①をもとに起こした、視覚情報だけの英語の情景描写
  #
  # 具体物まで情景に置き換えると、かえって余計な物語が混ざって画像が散らかる。
  # そのため subject_kind で作り分け、具体物は今までどおり対象そのものを主役に据える。
  # （＝具体物の画質を落とさずに、概念語だけを救う）
  class BriefService
    class GenerationError < StandardError; end

    DEFAULT_MODEL = "gpt-4o-mini"
    # プロンプトを変えたらキャッシュも作り直す。この番号がキャッシュキーに入る
    PROMPT_VERSION = 1
    # 出来上がりが長すぎると画像生成側が主題を見失うため、上限を設ける
    MAX_SCENE_PROMPT_LENGTH = 900
    MAX_DESCRIPTION_LENGTH = 1200

    SYSTEM_PROMPT = <<~PROMPT.freeze
      あなたは、単語や概念を「人が見て理解できる一枚の絵」へ翻訳する専門家です。
      与えられた語について、次の JSON のみを返してください。
      {"description": "...", "subject_kind": "concrete|abstract", "scene_prompt": "..."}

      description（日本語・150〜250字）
        その語が何であるかを、学習者が読んで腑に落ちる密度で書く。
        定義だけで終わらせず、成り立ち・典型的な場面・具体例・混同しやすい語との違いのうち、
        絵にするときの手がかりになるものを含める。
        実在が確認できない語・意味を特定できない語は、推測で埋めずその旨を書く。

      subject_kind
        "concrete" … 目で見て形のあるもの、または目に見える動作（りんご、消防車、富士山、走る）
        "abstract" … 形の無いもの（機会費用、正義、インフレ、懐かしさ、抽象的な関係や性質）

      scene_prompt（英語・視覚情報だけ）
        concrete のとき（20〜40語）
          対象そのものを主役に据える。余計な物語や背景設定を足さない。
          その語を他と取り違えずに特定するために必要な視覚的特徴（形・素材・質感・状態・大きさの手がかり）
          だけを添える。
        abstract のとき（40〜70語）
          その語の意味が成り立っている具体的な場面をひとつ選び、何がどこにどう写っているかを描写する。
          見た人が絵から語の意味へ辿れる、広く通じる情景にする。
          比喩を複数混ぜない。矢印・記号・図解・グラフ・文字に頼らない。
        共通
          文字・数字・ロゴ・透かしを含めない。
          画風（写真風・水彩・アニメ等）やカメラ設定は書かない。画風は利用者の設定で別に付く。
          人物を出すときは特定の実在人物を指定しない。
    PROMPT

    Result = Struct.new(:description, :subject_kind, :scene_prompt, :model, keyword_init: true)

    def self.call(title:)
      new(title).call
    end

    def initialize(title)
      @title = title.to_s.strip
    end

    def call
      raise GenerationError, "単語が空です" if @title.blank?

      request
    end

    private

    def request
      client = ::OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"), request_timeout: 30)
      response = client.chat(
        parameters: {
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: @title }
          ],
          # 同じ単語なら誰が作っても同じ結果になってほしい（キャッシュを効かせるため）
          temperature: 0,
          response_format: { type: "json_object" }
        }
      )

      parse(response.dig("choices", 0, "message", "content").to_s)
    end

    def parse(content)
      parsed = JSON.parse(content)
      description = parsed["description"].to_s.strip
      scene_prompt = parsed["scene_prompt"].to_s.strip
      raise GenerationError, "説明文を生成できませんでした" if description.blank?
      raise GenerationError, "情景プロンプトを生成できませんでした" if scene_prompt.blank?

      Result.new(
        description: description.first(MAX_DESCRIPTION_LENGTH),
        subject_kind: normalize_kind(parsed["subject_kind"]),
        scene_prompt: scene_prompt.first(MAX_SCENE_PROMPT_LENGTH),
        model: model
      )
    rescue JSON::ParserError => e
      raise GenerationError, "情景の解析に失敗しました: #{e.message}"
    end

    def normalize_kind(value)
      kind = value.to_s.strip.downcase
      SharedBrief::SUBJECT_KINDS.include?(kind) ? kind : "concrete"
    end

    def model
      ENV.fetch("OPENAI_BRIEF_MODEL", ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL))
    end
  end
end
