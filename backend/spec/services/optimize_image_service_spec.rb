require "rails_helper"

RSpec.describe OptimizeImageService do
  def png_bytes(width, height)
    Vips::Image.black(width, height).pngsave_buffer
  end

  describe ".call" do
    before { skip "libvips 未インストール環境のためスキップ" unless vips_available? }

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
      expect(result.thumb_data).to be_nil
      expect(result.lqip).to be_nil
    end

    it "一覧用サムネ(480px 以内の WebP)を生成する" do
      result = described_class.call(image_data: png_bytes(1600, 1200), content_type: "image/png")

      expect(result.thumb_data).to be_present
      thumb = Vips::Image.new_from_buffer(result.thumb_data, "")
      expect([ thumb.width, thumb.height ].max).to be <= 480
    end

    it "LQIP を WebP の data URL として返す" do
      result = described_class.call(image_data: png_bytes(1024, 1024), content_type: "image/png")

      expect(result.lqip).to start_with("data:image/webp;base64,")
      # 極小なので本体よりはるかに小さい
      expect(result.lqip.bytesize).to be < result.data.bytesize
    end
  end

  # libvips は中身を見てローダを選ぶため、allowlist 外は decode 自体させない
  # （SVG/PDF などの危険なローダに到達させない: CVE-2026-66066 対策）
  describe "形式 allowlist" do
    {
      "SVG" => %(<svg xmlns="http://www.w3.org/2000/svg"><text>x</text></svg>),
      "PDF" => "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n",
      "非画像" => "not an image"
    }.each do |label, payload|
      it "#{label} は libvips に渡さずフォールバックする" do
        expect(Vips::Image).not_to receive(:new_from_buffer) if vips_available?

        result = described_class.call(image_data: payload, content_type: "image/webp")

        expect(result.data).to eq(payload)
        expect(result.thumb_data).to be_nil
        expect(result.lqip).to be_nil
      end
    end
  end
end
