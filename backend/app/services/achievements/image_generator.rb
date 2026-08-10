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
    def attach!(result, prompt)
      @reward.image.attach(
        io: StringIO.new(result.image_data),
        filename: "#{@reward.key}.png",
        content_type: result.content_type.presence || "image/png"
      )
      @reward.update!(
        metadata: @reward.metadata.merge(
          "image_prompt" => prompt,
          "image_model" => result.metadata[:model] || result.metadata["model"],
          "image_generated_at" => Time.current.iso8601
        )
      )
    end
  end
end
