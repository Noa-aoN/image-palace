# libvips（ruby-vips）が利用可能かを判定するヘルパ。
# libvips 未インストール環境（素の ruby など）では画像系テストをスキップするために使う。
module VipsHelpers
  def vips_available?
    require "vips"
    true
  rescue LoadError
    # REQUIRE_VIPS=1（CI で設定）のときはスキップを許さない。
    # CVE-2026-66066 対策（allowlist / block_untrusted）の回帰検知が
    # 「実行環境に libvips が無い」という理由で静かに消えるのを防ぐため。
    raise "libvips を読み込めません。REQUIRE_VIPS=1 の環境では画像テストのスキップは許可されません" if ENV["REQUIRE_VIPS"] == "1"

    false
  end
end

RSpec.configure do |config|
  config.include VipsHelpers
end
