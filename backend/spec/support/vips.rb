# libvips（ruby-vips）が利用可能かを判定するヘルパ。
# CI など libvips 未インストール環境では画像最適化系テストをスキップするために使う。
module VipsHelpers
  def vips_available?
    require "vips"
    true
  rescue LoadError
    false
  end
end

RSpec.configure do |config|
  config.include VipsHelpers
end
