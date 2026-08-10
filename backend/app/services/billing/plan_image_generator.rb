# frozen_string_literal: true

module Billing
  # プランの徽章を作る。
  #
  # 獲得物と**同じ絵柄の決まり**（Achievements::ImageGenerator のSTYLEと素材表）を使う。
  # 別の作り方にすると、並べたときに世界観がばらつく。
  #
  # プランは運営が用意する固定の素材なので、鍵だけを持ち、環境ごとには作り直さない。
  class PlanImageGenerator
    def self.call(...)
      new(...).call
    end

    def initialize(plan:)
      @plan = plan
    end

    def call
      prompt = build_prompt
      result = GenerateImageService.call(
        prompt: prompt, aspect_ratio: "square", kind: "reward", options: { transparent: true }
      )
      blob = ActiveStorage::Blob.create_and_upload!(
        io: StringIO.new(result.image_data),
        filename: "plan_#{@plan.tier}.png",
        content_type: result.content_type.presence || "image/png"
      )
      @plan.update!(image_key: blob.key)
      @plan
    end

    def build_prompt
      level, motif = Achievements::ImageGenerator::PLAN_MOTIFS.fetch(@plan.tier, [ 2, "an olive sprig" ])
      material = Achievements::ImageGenerator::RARITY_MATERIALS.fetch(level)

      [
        "#{Achievements::ImageGenerator::PLAN_SUBJECT}, made of #{material}.",
        "Design: #{motif}.",
        Achievements::ImageGenerator::STYLE
      ].join("\n")
    end
  end
end
