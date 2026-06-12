# frozen_string_literal: true

require "vips"

# 生成画像を保存前に最適化するサービス。
# - 長辺を MAX_DIMENSION 以内にリサイズ（拡大はしない）
# - WebP へ変換し、ストレージ容量・配信コスト・表示パフォーマンスを改善する
#
# 変換に失敗した場合は元データをそのまま返す（生成フローを止めない）。
class OptimizeImageService
  MAX_DIMENSION = 800
  WEBP_QUALITY = 80

  Result = Struct.new(:data, :content_type, :extension, keyword_init: true)

  def self.call(image_data:, content_type: nil)
    new(image_data, content_type).call
  end

  def initialize(image_data, content_type)
    @image_data = image_data
    @content_type = content_type
  end

  def call
    image = Vips::Image.new_from_buffer(@image_data, "")

    # 長辺が MAX_DIMENSION を超える場合のみ縮小する（拡大はしない）
    scale = [ MAX_DIMENSION.to_f / image.width, MAX_DIMENSION.to_f / image.height, 1.0 ].min
    image = image.resize(scale) if scale < 1.0

    data = image.webpsave_buffer(Q: WEBP_QUALITY, strip: true)

    Result.new(data: data, content_type: "image/webp", extension: "webp")
  rescue StandardError => e
    Rails.logger.warn "[OptimizeImageService] 最適化に失敗したため元画像を使用します: #{e.class}: #{e.message}"
    Result.new(
      data: @image_data,
      content_type: @content_type.presence || "image/png",
      extension: extension_for(@content_type)
    )
  end

  private

  def extension_for(content_type)
    case content_type
    when "image/webp" then "webp"
    when "image/jpeg", "image/jpg" then "jpg"
    else "png"
    end
  end
end
