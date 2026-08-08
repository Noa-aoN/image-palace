require "rails_helper"

# CVE-2026-66066（KindaRails2Shell）対策が「実際に効いている」ことを確認する。
# 方針の経緯は docs/decisions/image-upload-security.md を参照。
#
# 公表記事の成立条件は「Active Storage でアップロードを受ける」「libvips で処理する」
# 「環境内の libvips が特定形式を処理できる状態にある」の3つ。本アプリは前2つを満たすため、
# 3つ目を潰し続けることが防御そのものになる。以下はその状態を固定するテスト。
#
# libvips 8.16.1 での実測（対策なしの場合）:
#   svgload  … 復号に成功する（block_untrusted で塞がる）
#   pdfload  … poppler が動作する（block_untrusted では塞がらない）
#   heifload … 壊れた入力でプロセスごと abort する（同上）
#
# ここが赤くなったら防御が外れている。設定を戻すまでデプロイしないこと。
RSpec.describe "libvips の多層防御（CVE-2026-66066）" do
  before { skip "libvips 未インストール環境のためスキップ" unless vips_available? }

  def registered?(operation)
    Vips.type_find("VipsOperation", operation) != 0
  end

  # 1層目: Dockerfile で削除したローダモジュール。
  # block_untrusted が届かない pdf / heif を、存在ごと消して塞いでいる
  describe "使わないローダモジュールがイメージに存在しない" do
    %w[pdfload_buffer heifload_buffer magickload_buffer jxlload_buffer].each do |operation|
      it "#{operation} が登録されていない" do
        expect(registered?(operation)).to be(false)
      end
    end
  end

  # 2層目: initializer のローダ allowlist（+ block_untrusted）。
  # 「拒否された」だけでは不十分で、ローダ不在なら "not in a known format" になり
  # 防御の検証にならない。ブロックが理由であることまで確かめる
  describe "内蔵ローダが allowlist で塞がれている" do
    {
      "svgload_buffer" => %(<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>),
      "tiffload_buffer" => "II*\x00",
      "gifload_buffer" => "GIF89a"
    }.each do |operation, payload|
      it "#{operation} がブロックされている" do
        skip "#{operation} は未登録" unless registered?(operation)

        expect { Vips::Image.public_send(operation, payload.b) }
          .to raise_error(Vips::Error, /blocked/)
      end
    end

    it "ruby-vips が block_untrusted に対応している" do
      # 2.2.1 未満だと initializer の呼び出しが no-op になり、環境変数頼みになる
      expect(Vips).to respond_to(:block_untrusted)
    end
  end

  # 過剰ブロックの検出。ここが赤いと画像機能そのものが壊れている
  describe "許可形式（ImageFormat::ALLOWED）は通常どおり扱える" do
    it "PNG / JPEG / WebP を読み込んで WebP に変換できる" do
      source = Vips::Image.black(8, 8)

      [ source.pngsave_buffer, source.jpegsave_buffer, source.webpsave_buffer ].each do |data|
        image = Vips::Image.new_from_buffer(data, "")

        expect(image.width).to eq(8)
        expect(image.webpsave_buffer).to be_present
      end
    end
  end

  # 3層目: 環境変数。initializer が消えても止まる二重掛けを維持する
  describe "デプロイ設定" do
    it "fly.toml に VIPS_BLOCK_UNTRUSTED=1 が設定されている" do
      expect(Rails.root.join("fly.toml").read).to match(/VIPS_BLOCK_UNTRUSTED\s*=\s*'1'/)
    end
  end
end
