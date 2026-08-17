# frozen_string_literal: true

module Achievements
  # 獲得物の絵を作る。
  #
  # 世界観（古代ギリシャ・記憶の宮殿）を1か所で決め、獲得物ごとの言葉だけを差し替える。
  # 絵柄がばらつくと、並べたときに「集めたもの」に見えない。
  #
  # **作った指示は metadata に残す。** あとで作り直すときに、
  # 何を渡したのか分からないと同じ系統の絵にできない。
  #
  # 出来た絵は差し替えられる（管理画面からのアップロードで上書きできる）。
  class ImageGenerator
    class GenerationError < StandardError; end

    # 種類ごとの見せ方。ここを変えると全部の絵柄が変わる
    KIND_SUBJECTS = {
      "title" => "an engraved marble stele with a laurel wreath and ribbon, no readable text",
      "medal" => "a ceremonial medal or star badge on a ribbon",
      "treasure" => "a single ancient Greek artifact",
      "honor" => "an official award plaque with a wreath and seal"
    }.freeze

    # レア度で質感を変える。並べたときに序列が伝わるようにする。
    # 名前（石・青銅・大理石…）と素材を揃えてあるので、絵を見れば段が分かる
    RARITY_MATERIALS = {
      1 => "rough limestone", 2 => "weathered bronze", 3 => "white marble",
      4 => "polished silver", 5 => "burnished gold",
      6 => "gold with deep lapis lazuli inlay", 7 => "silver with star-like enamel inlay",
      8 => "ivory and gold with a faint inner glow",
      9 => "iridescent alabaster and gold with a soft aura"
    }.freeze

    STYLE = <<~STYLE.strip
      Centered single object, isolated on a fully transparent background.
      Ancient Greek / classical antiquity aesthetic, museum artifact lighting,
      soft shadows on the object itself only, no ground shadow, no background scenery.
      Clean icon-like silhouette that stays readable at small size.
      The surface must be completely blank: absolutely no text, no letters,
      no numbers, no glyphs, no inscriptions, no watermark, no border, no frame.
    STYLE

    # プランの徽章。獲得物と同じ絵柄の決まりで作る。
    # 別の作り方にすると、並べたときに世界観がばらつく
    PLAN_SUBJECT = "a circular guild emblem medallion with a laurel border"

    PLAN_MOTIFS = {
      "free" => [ 2, "a simple clay tablet with a single olive sprig" ],
      "standard" => [ 3, "a scribe's reed pen crossed with a scroll" ],
      "pro" => [ 5, "an open codex with a small oil lamp above it" ],
      "creator" => [ 6, "an owl perched on a stack of scrolls" ],
      "studio" => [ 7, "a temple facade with columns and a laurel crown" ]
    }.freeze

    def self.call(...)
      new(...).call
    end

    def initialize(reward:, user_id: nil)
      @reward = reward
      @user_id = user_id
    end

    def call
      prompt = build_prompt
      result = GenerateImageService.call(
        prompt: prompt, aspect_ratio: "square", kind: "reward", user_id: @user_id,
        # 他の上に重ねるものなので背景を抜く
        options: { transparent: true }
      )
      attach!(result, prompt)
      @reward
    rescue Faraday::Error, KeyError => e
      raise GenerationError, "絵を作れませんでした: #{e.class}: #{e.message}"
    end

    # 指示は**英語だけ**で組む。
    # 日本語の名前や説明を混ぜると、その文字が絵の中に彫り込まれて出てくる
    # （「文字を入れるな」と書いても効かない。渡さないのが確実）。
    def build_prompt
      subject = KIND_SUBJECTS.fetch(@reward.kind, KIND_SUBJECTS["treasure"])
      material = RARITY_MATERIALS.fetch(@reward.rarity_level, RARITY_MATERIALS[2])
      motif = @reward.metadata["motif"].presence

      [ "#{subject}, made of #{material}.", motif && "Design: #{motif}.", STYLE ].compact.join("\n")
    end

    private

    # 生成の一次データ（PNG）をそのまま持つ。カード画像の最適化は通さない。
    # 17枚の小さな絵に、切り出しとサムネ生成の仕組みを通す理由が無い
    #
    # **貼るのは絵が出来てから。** 先に古いものを消してから作ると、
    # 生成が落ちた時に絵の無い獲得物ができる。
    # 置き換え（has_one_attached）は Rails が「新しいものを貼ってから古いものを捨てる」
    # 順で行うので、この順序のまま任せる。
    #
    # 行を掴んでから触るのは、**同じ獲得物を2つの処理が同時に貼ると重ねて残る**ため。
    # 実際に本番で起きた（生成の指示が二重に走り、1分違いで2件ぶら下がった）。
    # 掴むのは貼り替えの間だけで、生成（外部API）は外で終わらせてある。
    def attach!(result, prompt)
      @reward.with_lock do
        @reward.image.attach(
          io: StringIO.new(result.image_data),
          filename: "#{@reward.key}.png",
          content_type: result.content_type.presence || "image/png"
        )
        # 鍵も控える。他の環境から同じ絵を指せるようにするため
        @reward.update!(
          image_key: @reward.image.blob.key,
          metadata: @reward.metadata.merge(
            "image_prompt" => prompt,
            "image_model" => result.metadata[:model] || result.metadata["model"],
            "image_generated_at" => Time.current.iso8601
          )
        )
        RewardImageAttachment.prune_extras!(@reward)
      end
    end
  end
end
