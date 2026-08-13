require "uri"
require "active_support/core_ext/object/blank"

# テスト用 DB の接続先を決める。
# rails_helper が config/environment を読む前に呼ぶので、Rails には依存しない。
module TestDatabaseUrl
  DEFAULT = "postgresql://postgres@localhost:5432/image_palace_test".freeze
  SUFFIX = "_test".freeze

  # 明示指定 > 開発用 URL の DB 名を _test 版に読み替え > 既定
  def self.resolve(explicit, current)
    return explicit if explicit.present?
    return DEFAULT if current.blank?

    uri = URI.parse(current)
    name = uri.path.to_s.delete_prefix("/")
    return current if name.end_with?(SUFFIX)
    return DEFAULT if name.empty?

    uri.path = "/#{name.delete_suffix('_development')}#{SUFFIX}"
    uri.to_s
  rescue URI::InvalidURIError
    DEFAULT
  end
end
