require "rails_helper"

RSpec.describe ImageFormat do
  describe ".detect" do
    it "PNG を判定する" do
      png = "\x89PNG\r\n\x1A\n".b + ("\x00".b * 8)
      expect(described_class.detect(png)).to eq(:png)
    end

    it "JPEG を判定する" do
      jpeg = "\xFF\xD8\xFF\xE0".b + ("\x00".b * 8)
      expect(described_class.detect(jpeg)).to eq(:jpeg)
    end

    it "WebP を判定する（RIFF....WEBP）" do
      webp = "RIFF".b + "\x00\x00\x00\x00".b + "WEBP".b
      expect(described_class.detect(webp)).to eq(:webp)
    end

    it "GIF を判定する（現時点では ALLOWED 外）" do
      expect(described_class.detect("GIF89a".b + ("\x00".b * 6))).to eq(:gif)
      expect(described_class.detect("GIF87a".b + ("\x00".b * 6))).to eq(:gif)
    end

    it "RIFF でも WEBP でなければ判定しない" do
      wav = "RIFF".b + "\x00\x00\x00\x00".b + "WAVE".b
      expect(described_class.detect(wav)).to be_nil
    end

    it "SVG / PDF など危険なローダ向けの形式は判定しない" do
      expect(described_class.detect(%(<svg xmlns="http://www.w3.org/2000/svg"></svg>))).to be_nil
      expect(described_class.detect("%PDF-1.7\n%\xE2\xE3\xCF\xD3")).to be_nil
    end

    it "nil・短すぎるデータは判定しない" do
      expect(described_class.detect(nil)).to be_nil
      expect(described_class.detect("")).to be_nil
      expect(described_class.detect("\x89PNG")).to be_nil
    end
  end

  describe ".allowed?" do
    it "許可形式のみ true を返す" do
      expect(described_class.allowed?("\x89PNG\r\n\x1A\n".b + ("\x00".b * 8))).to be(true)
      expect(described_class.allowed?(%(<svg xmlns="http://www.w3.org/2000/svg"></svg>))).to be(false)
    end

    # 解禁時はこの期待値を反転させる（ALLOWED に :gif を追加）
    it "GIF は判定できても現時点では許可しない" do
      gif = "GIF89a".b + ("\x00".b * 6)
      expect(described_class.detect(gif)).to eq(:gif)
      expect(described_class.allowed?(gif)).to be(false)
    end
  end
end
