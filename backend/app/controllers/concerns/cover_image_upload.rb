# ユーザーがアップロードするカバー画像を最適化して添付する共通処理。
# 生成画像と同様に OptimizeImageService（libvips）で 800px WebP 化＋EXIF除去し、
# 一覧用サムネ(480px)も cover_thumb として保存する。非画像/過大サイズは弾く。
module CoverImageUpload
  extend ActiveSupport::Concern

  class InvalidCover < StandardError; end

  MAX_UPLOAD_BYTES = 10.megabytes

  private

  def attach_optimized_cover!(record, file)
    require "stringio"
    raise InvalidCover, "画像が大きすぎます（10MB まで）" if file.size.to_i > MAX_UPLOAD_BYTES

    optimized = OptimizeImageService.call(image_data: file.read, content_type: file.content_type)
    # 最適化が WebP を生成できない＝画像として読めなかった（壊れている/非画像）とみなす。
    raise InvalidCover, "画像として読み込めませんでした。別のファイルでお試しください。" unless optimized.extension == "webp"

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
end
