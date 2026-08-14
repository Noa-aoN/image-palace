# frozen_string_literal: true

module Admin
  # 数字から「いまの見立て」を作る。
  #
  # **数字はこちらで確定させ、AI には解釈と順番付けだけを任せる**（BriefInputBuilder）。
  # 計算まで任せると、合っているかを確かめる手立てが無いまま数字が出てくる。
  #
  # 作るのは明示的に更新したときだけ。画面を開くたびには作らない。
  class BriefGenerator
    class GenerationError < StandardError; end

    MODEL = "gpt-4o-mini"

    # 守らせること。**教科書を積まない。**
    # 長い一般論を入れるほど、この製品の数字から離れた話が返ってくる。
    PRINCIPLES = <<~TEXT.freeze
      あなたは ImagePalace（単語や概念を AI 生成画像に変換して覚える学習サービス）の
      経営を見る相談相手です。個人開発で、正式公開の前段階にあります。

      # 守ること
        与えられた数字だけを使う。**自分で計算し直さない。数字を作らない。**
        maturity が measured でないものは、評価の材料にしない。
        「未計測」を 0 として扱わない。測っていないことと、起きていないことは違う。
        reliability が low のものは、確信度を下げる。母数が小さければ1人で大きく振れる。
        並んで動いたことを、原因と結果だと言い切らない。
        分からないことは分からないと言う。取り繕わない。
        根拠の無い見立ては出さない。**すべての見立てに、渡された数字を根拠として添える。**
        短い期間の数字だけを上げる案を勧めない。使い心地や信頼を損なう案は、その旨を書く。
        法律・税務・会計上の断定をしない。
        次にやることは3件まで。多いと、どれもやらないことになる。

      # 事情
        利用者はまだ少なく、有料の契約はまだ無い。
        画像1枚が1クレジット。文章の生成は1回0.01クレジット。
        インフラ費は使われなくても出ていく（固定費）。
        開発者は1人。手を動かせる量に限りがある。
    TEXT

    OUTPUT_SCHEMA = <<~TEXT.freeze
      次の JSON だけを返してください。それ以外は書かないでください。

      {
        "highlights": ["今週の要点。3件まで。数字を含めて短く"],
        "changes": ["気になる変化。3件まで。無ければ空の配列"],
        "top_issue": "いちばんの課題。1文",
        "actions": ["次にやること。3件まで。動詞で始める"],
        "insights": [
          {
            "observation": "何が起きているか",
            "evidence": ["根拠にした数字。渡されたものをそのまま引く"],
            "confidence": "low | medium | high",
            "impact": "low | medium | high",
            "urgency": "low | medium | high",
            "suggested_action": "そのために何をするか"
          }
        ]
      }

      insights は3件まで。evidence が書けないものは出さないでください。
    TEXT

    def self.call(...)
      new(...).call
    end

    def initialize(user:, period: Period::DEFAULT, now: Time.current)
      @user = user
      @period = period
      @now = now
    end

    def call
      input = BriefInputBuilder.call(period: @period, now: @now)
      response = request(input)
      parsed = parse(response)

      save!(input, parsed, response)
    end

    private

    def request(input)
      Ai::Chat.call(
        kind: "admin_brief",
        user: @user,
        model: MODEL,
        messages: [
          { role: "system", content: "#{PRINCIPLES}\n\n#{OUTPUT_SCHEMA}" },
          { role: "user", content: JSON.pretty_generate(input.as_json) }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      )
    end

    def parse(response)
      content = response.dig("choices", 0, "message", "content").to_s
      JSON.parse(content)
    rescue JSON::ParserError => e
      raise GenerationError, "AI の応答を解釈できませんでした: #{e.message}"
    end

    # 途中で転んでも、前の見立てを壊さない。**丸ごと入るか、何も入らないか。**
    def save!(input, parsed, response)
      usage = response["usage"] || {}
      period = input[:period]

      AdminBrief.transaction do
        brief = AdminBrief.create!(
          generated_by: @user,
          period_key: period[:key], period_from: period[:from], period_to: period[:to],
          facts: input[:facts], completeness: input[:completeness],
          summary: summary_of(parsed),
          model: MODEL,
          prompt_tokens: usage["prompt_tokens"].to_i,
          completion_tokens: usage["completion_tokens"].to_i,
          cost_points: ::Ai::UsageLimit.cost_points("admin_brief")
        )
        insights_of(parsed).each_with_index { |row, index| create_insight!(brief, row, index) }
        # 「次にやること」は行として持つ。**見立てとは別**（AI は別々に書くので対応しない）
        brief.summary["actions"].each_with_index do |title, index|
          next if title.blank?

          brief.admin_brief_actions.create!(title: title, position: index)
        end
        brief
      end
    end

    def summary_of(parsed)
      {
        "highlights" => Array(parsed["highlights"]).first(3).map(&:to_s),
        "changes" => Array(parsed["changes"]).first(3).map(&:to_s),
        "top_issue" => parsed["top_issue"].to_s,
        "actions" => Array(parsed["actions"]).first(3).map(&:to_s)
      }
    end

    def insights_of(parsed)
      Array(parsed["insights"]).first(3).select { |row| row.is_a?(Hash) }
    end

    # 形の合わないものは落とす。**根拠の無い見立ては置かない**（モデル側の検証で弾く）
    def create_insight!(brief, row, index)
      brief.admin_insights.create!(
        position: index,
        observation: row["observation"].to_s,
        evidence: Array(row["evidence"]).map(&:to_s),
        confidence: level(row["confidence"]),
        impact: level(row["impact"]),
        urgency: level(row["urgency"]),
        suggested_action: row["suggested_action"].to_s
      )
    rescue ActiveRecord::RecordInvalid => e
      Rails.logger.warn "[Admin::BriefGenerator] skipped insight: #{e.message}"
    end

    # 知らない語が来たら、いちばん弱いものに倒す
    def level(value)
      AdminInsight::LEVELS.include?(value.to_s) ? value.to_s : "low"
    end
  end
end
