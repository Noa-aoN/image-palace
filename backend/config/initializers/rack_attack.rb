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

  # 画像アップロード（1件最大 10MB を libvips でデコードする高コスト操作）:
  # 1 IP あたり 60 秒間で 20 回まで。全体上限（300req/5分）だけだと
  # 10MB × 300 の転送と libvips のデコードを短時間に強いられるため、個別に絞る。
  # 運営の読みものの見出し画像も同じ経路（libvips を通る）なので、同じ枠で絞る
  UPLOAD_PATH = %r{\A/api/v1/(boxes|views|spaces)/[^/]+/(cover_image|background_image)\z|
                   \A/api/v1/admin/posts/[^/]+/cover\z}x
  throttle("image_uploads/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.post? && UPLOAD_PATH.match?(req.path)
  end

  # 運営（管理）エンドポイント。総当たりで権限の有無を探られないよう、個別に絞る。
  # 正規の運営が普通に使う限り当たらない値にする。
  throttle("admin/ip", limit: 60, period: 60.seconds) do |req|
    req.ip if req.path.start_with?("/api/v1/admin/")
  end

  # キャンバスの AI 編集（1回の呼び出しが他より大きい）
  AI_EDIT_PATH = %r{\A/api/v1/views/[^/]+/ai_edit\z}
  throttle("canvas_ai_edit/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.post? && AI_EDIT_PATH.match?(req.path)
  end

  # カバー画像の生成（画像生成＝高コスト）
  COVER_GENERATE_PATH = %r{\A/api/v1/(boxes|views|spaces)/[^/]+/cover_image/generate\z}
  throttle("cover_generate/ip", limit: 10, period: 60.seconds) do |req|
    req.ip if req.post? && COVER_GENERATE_PATH.match?(req.path)
  end

  # アバターの生成（画像生成＝高コスト）。自分の顔は何度も作り直すものではない。
  throttle("avatar_generate/ip", limit: 10, period: 60.seconds) do |req|
    req.ip if req.post? && req.path == "/api/v1/account/avatar"
  end

  # 記憶資産の点（作成・更新とも画像生成をトリガーし得る）。
  # 並べ替え（reorder）は画像を作らないうえドラッグで連続するので、ここには含めない。
  SPACE_POINT_PATH = %r{\A/api/v1/spaces/[^/]+/points(/(?!reorder\z)[^/]+)?\z}
  throttle("space_points/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if (req.post? || req.patch? || req.put?) && SPACE_POINT_PATH.match?(req.path)
  end

  # 説明文・情景の作り直し（OpenAI Chat 呼び出し）
  throttle("item_brief/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/items/[^/]+/brief\z})
  end

  # カードの項目まわり（値・定義）。AI は通らないが、書き込みなので歯止めは要る
  PROPERTY_PATH = %r{\A/api/v1/(items/[^/]+/properties/[^/]+|property_definitions(/.*)?)\z}
  throttle("item_properties/ip", limit: 120, period: 60.seconds) do |req|
    req.ip if !req.get? && PROPERTY_PATH.match?(req.path)
  end

  # 意味・説明の追加・書き換え（AI は通らないが、書き込みなので歯止めは要る）
  MEANING_PATH = %r{\A/api/v1/items/[^/]+/meanings(/.*)?\z}
  throttle("item_meanings/ip", limit: 60, period: 60.seconds) do |req|
    req.ip if (req.post? || req.patch? || req.put? || req.delete?) && MEANING_PATH.match?(req.path)
  end

  # 項目のAI一括入力（OpenAI Chat 呼び出し）
  throttle("item_fill_properties/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/items/[^/]+/fill_properties\z})
  end

  # 意味・説明からの情景の書き直し（OpenAI Chat 呼び出し）
  throttle("item_scene_rewrite/ip", limit: 20, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.match?(%r{\A/api/v1/items/[^/]+/scene_rewrite\z})
  end

  # 供給側の疎通確認（OpenAI へ実際に1回投げる）。運営しか叩けないが、連打で外へ投げ続けないよう抑える
  throttle("admin_provider_check/ip", limit: 10, period: 5.minutes) do |req|
    req.ip if req.post? && req.path == "/api/v1/admin/provider_check"
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
