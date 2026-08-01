# frozen_string_literal: true

require "base64"

# 生成画像を保存前に最適化するサービス。
# 1回のデコードから以下を作る：
# - 本体: 長辺 MAX_DIMENSION 以内の WebP（拡大はしない）
# - サムネ: 長辺 THUMB_DIMENSION 以内の WebP（一覧の CDN 直配信用）
# - LQIP: 極小 WebP を data URL 化したプレースホルダ（即時ぼかし表示用）
#
# 変換に失敗した場合は元データをそのまま返す（thumb/lqip は nil。生成フローを止めない）。
# ただし libvips へ渡すのは PNG/JPEG/WebP と判定できたデータのみ（ImageFormat）。
# 未対応形式は libvips に触れさせずフォールバックするため、呼び出し側で
# 「本当に WebP 化されたか」を検証してから保存すること（アップロード経路は必須）。
class OptimizeImageService
  # allowlist 外の形式（libvips に渡さず弾いた）
  class UnsupportedFormat < StandardError; end

  MAX_DIMENSION = 800
  THUMB_DIMENSION = 480
  LQIP_DIMENSION = 24
  WEBP_QUALITY = 80
  THUMB_QUALITY = 75
  LQIP_QUALITY = 30

  Result = Struct.new(:data, :content_type, :extension, :thumb_data, :lqip, keyword_init: true)

  def self.call(image_data:, content_type: nil, crop_ratio: nil)
    new(image_data, content_type, crop_ratio).call
  end

  # crop_ratio: 幅/高さ。指定されると中央基準でその比へ切り出す
  # （画像生成 API が出せない比＝黄金比などのため）。
  def initialize(image_data, content_type, crop_ratio = nil)
    @image_data = image_data
    @content_type = content_type
    @crop_ratio = crop_ratio
  end

  def call
    # libvips は中身を見てローダを選ぶため、渡す前にマジックバイトで allowlist する。
    # （SVG/PDF など外部ライブラリ委譲を伴うローダへ到達させない）
    raise UnsupportedFormat, "対応していない画像形式です" unless ImageFormat.allowed?(@image_data)

    # libvips はネイティブライブラリ依存のため遅延 require する。
    # 未インストール環境でもアプリ起動を妨げないよう、ここで読み込む。
    require "vips"

    src = crop_to_ratio(Vips::Image.new_from_buffer(@image_data, ""))

    Result.new(
      data: webp_for(src, MAX_DIMENSION, WEBP_QUALITY),
      content_type: "image/webp",
      extension: "webp",
      thumb_data: webp_for(src, THUMB_DIMENSION, THUMB_QUALITY),
      lqip: lqip_data_url(src)
    )
  rescue StandardError, LoadError => e
    # LoadError: libvips 未インストール。StandardError: 不正な画像など。いずれも元画像でフォールバックする。
    Rails.logger.warn "[OptimizeImageService] 最適化に失敗したため元画像を使用します: #{e.class}: #{e.message}"
    Result.new(
      data: @image_data,
      content_type: @content_type.presence || "image/png",
      extension: extension_for(@content_type),
      thumb_data: nil,
      lqip: nil
    )
  end

  private

  # 指定の比へ中央基準で切り出す。比が近ければ何もしない（無駄な再エンコードを避ける）。
  def crop_to_ratio(image)
    return image if @crop_ratio.nil? || @crop_ratio <= 0

    current = image.width.to_f / image.height
    return image if (current - @crop_ratio).abs < 0.01

    if current > @crop_ratio
      width = (image.height * @crop_ratio).round
      image.crop(((image.width - width) / 2.0).round, 0, width, image.height)
    else
      height = (image.width / @crop_ratio).round
      image.crop(0, ((image.height - height) / 2.0).round, image.width, height)
    end
  end

  # 長辺が max_dim を超える場合のみ縮小して WebP バッファを返す（拡大はしない）。
  def webp_for(src, max_dim, quality)
    scale = [ max_dim.to_f / src.width, max_dim.to_f / src.height, 1.0 ].min
    image = scale < 1.0 ? src.resize(scale) : src
    image.webpsave_buffer(Q: quality, strip: true)
  end

  def lqip_data_url(src)
    bytes = webp_for(src, LQIP_DIMENSION, LQIP_QUALITY)
    "data:image/webp;base64,#{Base64.strict_encode64(bytes)}"
  end

  def extension_for(content_type)
    case content_type
    when "image/webp" then "webp"
    when "image/jpeg", "image/jpg" then "jpg"
    else "png"
    end
  end
end
