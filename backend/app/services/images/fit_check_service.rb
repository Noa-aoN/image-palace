# frozen_string_literal: true

module Images
  # 絵が、その語を思い出す助けになっているかを見る。
  #
  # 説明のファクトチェックとは別の問いを立てている。あちらが見るのは
  # 「書いてあることが世界と合っているか」。ここで見るのは **語と絵が噛み合っているか**で、
  # 絵そのものの巧拙ではない。
  #
  # 判定を分けているのは、直し方が違うため。
  #   fits     … そのままでよい
  #   weak     … 間違ってはいないが、この語だと思い出しにくい（作り直す価値がある）
  #   mismatch … 別の語の絵になっている（作り直すべき）
  #
  # **絵は毎回そのまま渡す。** 生成時の指示（scene_prompt）を読んで判断させると、
  # 指示どおりに描けなかった絵を「指示は正しいので合っている」と通してしまう。
  # 見るのは出来上がった絵のほうで、作るときに何を書いたかではない。
  class FitCheckService
    class GenerationError < StandardError; end
    # 絵が無い・読めないカードは、判定ではなく「見られなかった」として返す
    class NoImage < StandardError; end

    # 見るのは噛み合いで、細部ではない。detail: "low" で足りるうえ、
    # 高い解像度で見ると、1枚あたりの費用が桁で変わる
    DEFAULT_MODEL = "gpt-4o"
    IMAGE_DETAIL = "low"

    STATUSES = %w[fits weak mismatch].freeze

    SYSTEM_PROMPT = <<~PROMPT.freeze
      あなたは、記憶用の絵カードを点検する人です。
      与えられた「単語/概念」と、その説明と、1枚の絵を見て、
      **その絵がその語を思い出す助けになっているか**を判定してください。

      見るのは噛み合いです。絵の巧拙・画風・美しさは評価しません。

      status:
        "fits"     … その語の絵として妥当。見れば語を思い出せる
        "weak"     … 誤ってはいないが、思い出す手がかりとして弱い。
                     （例: 語の一部しか描かれていない／似た語と区別が付かない／
                       抽象的すぎて何の絵か読み取れない）
        "mismatch" … 別のものが描かれている。語とつながらない
                     （例: 綴りの似た別語の絵になっている／文字だけの図解）

      comment: なぜそう判定したかを、日本語で1〜2文。
               weak / mismatch のときは、**どう描き直せばよいか**を必ず一言添える。

      判断できないときは "weak" にし、なぜ読み取れないのかを comment に書いてください。

      必ず次の JSON 形式のみで返してください:
      {"status": "fits|weak|mismatch", "comment": "..."}
    PROMPT

    def self.call(item:)
      new(item).call
    end

    def initialize(item)
      @item = item
    end

    def call
      result = request
      @item.update!(
        image_check_status: result[:status],
        image_check_comment: result[:comment],
        image_checked_at: Time.current
      )
      @item
    end

    private

    # 絵そのもの。**URL では渡さない。**
    # 手元では画像が localhost にしか無く、外から取りに来られない。
    # 環境によって見られたり見られなかったりする作りにはしない
    def image_data_url
      blob = @item.primary_media&.file&.blob
      raise NoImage, "絵がありません" if blob.nil?

      bytes = blob.download
      raise NoImage, "絵を読み込めませんでした" if bytes.blank?

      "data:#{blob.content_type};base64,#{Base64.strict_encode64(bytes)}"
    rescue ActiveStorage::FileNotFoundError
      raise NoImage, "絵の実体が見つかりませんでした"
    end

    def user_content
      text = [ "単語/概念: #{@item.title}" ]
      meaning = @item.primary_meaning&.definition
      text << "説明: #{meaning}" if meaning.present?

      [
        { type: "text", text: text.join("\n") },
        { type: "image_url", image_url: { url: image_data_url, detail: IMAGE_DETAIL } }
      ]
    end

    def request
      response = Ai::Chat.call(
        kind: "image_fit_check",
        user: @item.user,
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user_content }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      )

      parse(response.dig("choices", 0, "message", "content").to_s)
    end

    def parse(content)
      parsed = JSON.parse(content)
      status = parsed["status"].to_s.strip
      # 知らない判定は、通さずに「弱い」へ寄せる。
      # 読めないものを fits にすると、点検したのに何も見ていないのと同じになる
      status = "weak" unless STATUSES.include?(status)

      { status: status, comment: parsed["comment"].to_s.strip }
    rescue JSON::ParserError => e
      raise GenerationError, "点検結果の解析に失敗しました: #{e.message}"
    end

    def model
      ENV.fetch("OPENAI_IMAGE_CHECK_MODEL", DEFAULT_MODEL)
    end
  end
end
