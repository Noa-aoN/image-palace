# ユーザーがアップロードするカバー画像を最適化して添付する共通処理。
# 生成画像と同様に OptimizeImageService（libvips）で 800px WebP 化＋EXIF除去し、
# 一覧用サムネ(480px)も cover_thumb として保存する。非画像/過大サイズは弾く。
#
# 信頼できない入力を libvips に渡す唯一の経路のため、多層で防御する:
#   1. サイズ上限
#   2. マジックバイトの allowlist（PNG/JPEG/WebP のみ libvips へ渡す）
#   3. 出力が実際に WebP バイト列であることを検証してから保存
#      （Content-Type 自己申告を信じた素通し保存を防ぐ）
module CoverImageUpload
  extend ActiveSupport::Concern

  class InvalidCover < StandardError; end

  MAX_UPLOAD_BYTES = 10.megabytes
  # 形式を特定できない/読めない場合のユーザー向けメッセージ（内部理由は明かさない）
  INVALID_MESSAGE = "画像として読み込めませんでした。別のファイルでお試しください。"

  private

  def attach_optimized_cover!(record, file)
    optimized = optimize_upload!(file)

    record.cover_image.attach(
      io: StringIO.new(optimized.data),
      filename: "#{SecureRandom.uuid}.webp",
      content_type: "image/webp"
    )
    record.cover_thumb.purge if record.cover_thumb.attached?
    return unless optimized.thumb_data

    record.cover_thumb.attach(
      io: StringIO.new(optimized.thumb_data),
      filename: "#{SecureRandom.uuid}.webp",
      content_type: "image/webp"
    )
  end

  # ボード背景など、サムネ不要の単一画像を最適化して添付する（attach 先を引数で指定）。
  def attach_optimized_image!(attachment, file)
    optimized = optimize_upload!(file)

    attachment.attach(
      io: StringIO.new(optimized.data),
      filename: "#{SecureRandom.uuid}.webp",
      content_type: "image/webp"
    )
  end

  # アップロードを検証しつつ最適化する。通れば戻り値の data は必ず WebP バイト列。
  def optimize_upload!(file)
    require "stringio"
    raise InvalidCover, "画像が大きすぎます（10MB まで）" if file.size.to_i > MAX_UPLOAD_BYTES

    data = file.read.to_s
    # libvips に渡す前に形式を確定させる（Content-Type は自己申告なので信用しない）。
    raise InvalidCover, INVALID_MESSAGE unless ImageFormat.allowed?(data)

    optimized = OptimizeImageService.call(image_data: data, content_type: file.content_type)
    # 最適化が WebP を生成できない＝画像として読めなかった（壊れている/非画像）とみなす。
    # extension だけでなく実バイト列も検証し、元データの素通し保存を防ぐ。
    raise InvalidCover, INVALID_MESSAGE unless ImageFormat.detect(optimized.data) == :webp

    optimized
  end
end
