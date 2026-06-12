# frozen_string_literal: true

# API レート制限（Rack::Attack）
#
# 目的:
#   - 認証エンドポイントへのブルートフォースを抑止する
#   - 画像生成など高コストな操作の乱用を防ぐ
#   - 単一クライアントによる過剰なリクエストからサービスを守る
#
# カウンタは専用の MemoryStore に保持する。MVP は Fly.io 単一インスタンス想定のため
# プロセスローカルで十分。将来スケールアウトする場合は共有ストア（Solid Cache 等）へ差し替える。
class Rack::Attack
  self.cache.store = ActiveSupport::Cache::MemoryStore.new

  ### スロットル設定 ###

  # 全体の安全網: 1 IP あたり 5 分間で 300 リクエストまで。ヘルスチェックは除外する。
  throttle("req/ip", limit: 300, period: 5.minutes) do |req|
    req.ip unless req.path.start_with?("/api/v1/health", "/up")
  end

  # ログイン試行: ブルートフォース対策。1 IP あたり 20 秒間で 10 回まで。
  throttle("logins/ip", limit: 10, period: 20.seconds) do |req|
    req.ip if req.post? && req.path == "/api/v1/auth/sign_in"
  end

  # 新規登録: 大量アカウント作成の抑制。1 IP あたり 60 秒間で 5 回まで。
  throttle("signups/ip", limit: 5, period: 60.seconds) do |req|
    req.ip if req.post? && req.path == "/api/v1/auth"
  end

  # カード作成（画像生成をトリガーし得る高コスト操作）: 1 IP あたり 60 秒間で 30 回まで。
  throttle("item_creates/ip", limit: 30, period: 60.seconds) do |req|
    req.ip if req.post? && req.path == "/api/v1/items"
  end

  ### スロットル時のレスポンス ###

  # 429 を JSON で返す。フロントエンドが一貫してエラー表示できるようにする。
  self.throttled_responder = lambda do |req|
    match_data = req.env["rack.attack.match_data"] || {}
    retry_after = match_data[:period].to_i

    headers = {
      "Content-Type" => "application/json",
      "Retry-After" => retry_after.to_s
    }
    body = { error: "リクエストが多すぎます。しばらく時間を置いてから再試行してください。" }.to_json

    [ 429, headers, [ body ] ]
  end
end
