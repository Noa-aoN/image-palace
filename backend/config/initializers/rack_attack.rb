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

  # 意味生成（OpenAI Chat 呼び出しの高コスト操作）: 1 IP あたり 60 秒間で 30 回まで。
  # 一覧での一括「説明を付与」（1ページ=24件）を1パスで通せるようにしつつ上限は維持。
  # 超過分はフロントが 429 を待って再試行する。
  throttle("item_meaning/ip", limit: 30, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/items/[^/]+/meaning\z})
  end

  # タグ生成（OpenAI Chat 呼び出しの高コスト操作）: 1 IP あたり 60 秒間で 30 回まで。
  throttle("item_tags/ip", limit: 30, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/items/[^/]+/tags\z})
  end

  # ファクトチェック（OpenAI Chat 呼び出しの高コスト操作）: 1 IP あたり 60 秒間で 30 回まで。
  throttle("item_fact_check/ip", limit: 30, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/items/[^/]+/fact_check\z})
  end

  # 失敗カードの再生成（画像生成ジョブを再投入）: 1 IP あたり 60 秒間で 20 回まで。
  throttle("item_retry/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/items/[^/]+/retry\z})
  end

  # データエクスポート（全データを返す重い操作）: 1 IP あたり 5 分間で 10 回まで。
  # 単語の生成・点検（AI 呼び出し）。ワードリスト作成・アクロポリスから叩かれる。
  throttle("words_generate/ip", limit: 30, period: 60.seconds) do |req|
    req.ip if req.post? && req.path == "/api/v1/words/generate"
  end
  throttle("words_check/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.post? && req.path == "/api/v1/words/check"
  end
  throttle("account_export/ip", limit: 10, period: 5.minutes) do |req|
    req.ip if req.get? && req.path == "/api/v1/account/export"
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
