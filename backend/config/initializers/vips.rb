# frozen_string_literal: true

# libvips のローダを絞り込む（CVE-2026-66066 / KindaRails2Shell 緩和策）。
# 本アプリはユーザーがアップロードした画像を libvips に渡すため、入口を狭くしておく。
# 方針の経緯と実測結果は docs/decisions/image-upload-security.md を参照。
#
# libvips 未インストール環境でも起動を妨げないよう、読み込み失敗は警告に留める。
begin
  require "vips"

  # ── 1) 信頼できないローダの無効化 ────────────────────────────
  # 環境変数 VIPS_BLOCK_UNTRUSTED=1（fly.toml / docker-compose.yml）と二重掛けにしている。
  # ここでの明示呼び出しは、環境変数の設定漏れやローカル実行時の保険。
  if Vips.respond_to?(:block_untrusted)
    Vips.block_untrusted(true)
  else
    Rails.logger.warn "[vips] block_untrusted 未対応の ruby-vips です。VIPS_BLOCK_UNTRUSTED 環境変数で対応してください"
  end

  # ── 2) ローダの allowlist ────────────────────────────────────
  # block_untrusted が止めるのは svg / magick / jxl だけで、pdf・heif・tiff・gif は
  # 素通りする（libvips 8.16.1 で実測）。扱う形式は ImageFormat::ALLOWED と同じ
  # PNG / JPEG / WebP だけなので、読み込みオペレーション全体を止めてから3つだけ戻す。
  #
  # ruby-vips 2.3 には operation_block_set の Ruby API が無いため C 関数を直接束縛する。
  # 保存側（VipsForeignSave*）は対象外なので WebP 変換には影響しない。
  begin
    Vips.attach_function :vips_operation_block_set, [ :string, :int ], :void unless Vips.respond_to?(:vips_operation_block_set)

    Vips.vips_operation_block_set("VipsForeignLoad", 1)
    %w[VipsForeignLoadPng VipsForeignLoadJpeg VipsForeignLoadWebp].each do |loader|
      Vips.vips_operation_block_set(loader, 0)
    end
  rescue FFI::NotFoundError, NoMethodError => e
    # libvips 8.13 未満。block_untrusted と ImageFormat の allowlist で受け止める
    Rails.logger.warn "[vips] ローダ allowlist を設定できませんでした: #{e.class}: #{e.message}"
  end
rescue LoadError, StandardError => e
  Rails.logger.warn "[vips] 初期化をスキップしました: #{e.class}: #{e.message}"
end
