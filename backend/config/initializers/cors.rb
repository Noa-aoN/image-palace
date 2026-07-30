# 許可オリジンは CORS_ORIGINS（カンマ区切り）で管理する。
# 認証トークン（access-token 等）を expose しているため、本番でのワイルドカード '*' は危険。除外する。
cors_origins = ENV.fetch("CORS_ORIGINS", "http://localhost:3000")
                  .split(",").map(&:strip).reject(&:blank?)

if Rails.env.production? && cors_origins.delete("*")
  Rails.logger.warn(
    "[CORS] 本番で '*' が指定されたため除外しました。CORS_ORIGINS に明示的なオリジンを設定してください。"
  )
end

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*cors_origins)
    resource "/api/*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options ],
      expose: [ "access-token", "uid", "client", "token-type", "expiry" ]
  end

  # 画像そのものの配信。3D ビューは WebGL テクスチャとして読み込むため CORS が必須で、
  # ヘッダーが無いとテクスチャの生成に失敗する（2D の <img> は CORS 不要なので気付きにくい）。
  # 読み取り専用なので GET のみ許可し、認証ヘッダーは expose しない。
  allow do
    origins(*cors_origins)
    resource "/rails/active_storage/*", headers: :any, methods: [ :get, :options ]
  end
end
