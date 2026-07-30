# frozen_string_literal: true

# libvips の「信頼できないローダ」を無効化する（CVE-2026-66066 / KindaRails2Shell 緩和策）。
# 本アプリはユーザーがアップロードした画像を libvips に渡すため、
# SVG/PDF など外部ライブラリ委譲を伴うローダを入口で塞いでおく。
#
# 環境変数 VIPS_BLOCK_UNTRUSTED=1（fly.toml / docker-compose）と二重掛けにしている。
# ここでの明示呼び出しは、環境変数の設定漏れやローカル実行時の保険。
#
# libvips 未インストール環境でも起動を妨げないよう、読み込み失敗は警告に留める。
begin
  require "vips"

  if Vips.respond_to?(:block_untrusted)
    Vips.block_untrusted(true)
  else
    Rails.logger.warn "[vips] block_untrusted 未対応の ruby-vips です。VIPS_BLOCK_UNTRUSTED 環境変数で対応してください"
  end
rescue LoadError, StandardError => e
  Rails.logger.warn "[vips] 初期化をスキップしました: #{e.class}: #{e.message}"
end
