require "rails_helper"

RSpec.describe OptimizeImageService do
  def png_bytes(width, height)
    Vips::Image.black(width, height).pngsave_buffer
  end

  describe ".call" do
    it "長辺が 800px を超える画像を 800px 以内の WebP に変換する" do
      result = described_class.call(image_data: png_bytes(1600, 1200), content_type: "image/png")

      expect(result.content_type).to eq("image/webp")
      expect(result.extension).to eq("webp")

      image = Vips::Image.new_from_buffer(result.data, "")
      expect([ image.width, image.height ].max).to be <= 800
    end

    it "800px 以内の画像は拡大しない（アスペクト比を維持）" do
      result = described_class.call(image_data: png_bytes(400, 300), content_type: "image/png")

      image = Vips::Image.new_from_buffer(result.data, "")
      expect(image.width).to eq(400)
      expect(image.height).to eq(300)
      expect(result.content_type).to eq("image/webp")
    end

    it "WebP 変換でファイルサイズが削減される" do
      original = png_bytes(1024, 1024)
      result = described_class.call(image_data: original, content_type: "image/png")

      expect(result.data.bytesize).to be < original.bytesize
    end

    it "不正な画像データはフォールバックして元データを返す" do
      result = described_class.call(image_data: "not an image", content_type: "image/png")

      expect(result.data).to eq("not an image")
      expect(result.content_type).to eq("image/png")
      expect(result.extension).to eq("png")
    end
  end
end
