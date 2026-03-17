# Security Rules — ImagePalace 固有ルール

## 環境変数・シークレット管理

- **絶対にコードに直書きしない**: API キー・パスワード・トークンはすべて環境変数
- ローカル開発: `.env.local`（`.gitignore` 済み、コミット禁止）
- staging/production: ホスティングサービス（Render / Railway / Cloudflare Pages）のダッシュボードで管理
- `.env.example` に変数名のみを列挙し、値は空またはダミー値とすること

### OpenAI API キー

- `OPENAI_API_KEY` は **バックエンドのみ** に設定する
- フロントエンドから OpenAI API を直接呼び出し禁止
- `NEXT_PUBLIC_` プレフィックスの変数はブラウザに露出するため、シークレット値に使わない

## Input Validation

- すべての外部入力（APIエンドポイント、フォーム、URLパラメータ）をシステム境界で検証する
- **フロントエンド**: zod スキーマによるランタイムバリデーション
- **バックエンド**: Rails の `validates` + Strong Parameters を必ず使う
- クライアントサイドのバリデーションのみに頼らない（サーバー側でも検証する）
- HTML 出力をサニタイズして XSS を防ぐ

## Rails セキュリティ

### Brakeman

- CI で Brakeman を実行し、High / Medium 警告は PR マージ前に解消する
- `brakeman --no-pager --format json` の出力を CI アーティファクトに保存

### ActiveRecord

- **パラメータ化クエリを使う**: 文字列結合による SQL 構築禁止
  ```ruby
  # NG
  User.where("name = '#{params[:name]}'")
  # OK
  User.where(name: params[:name])
  ```
- **マスアサインメント保護**: Strong Parameters を必ず使う
- **スコープ**: 認証ユーザーに紐づくレコードのみ返すスコープを定義する
  ```ruby
  # controller で必ず current_user スコープをかける
  current_user.cards.find(params[:id])
  ```

### 認証・認可

- 保護されたルートでは毎回認証チェックを行う
- 認証後に権限（パーミッション）チェックを行う
- 認証エンドポイントにレートリミットを実装する

## Next.js セキュリティ

### NEXT_PUBLIC_ 変数の扱い

- `NEXT_PUBLIC_` プレフィックスを持つ変数はビルド時にブラウザバンドルへ埋め込まれる
- 公開しても安全な値のみ（例: `NEXT_PUBLIC_API_BASE_URL`）に使用する
- API キー・トークン・DBパスワードは絶対に `NEXT_PUBLIC_` にしない

### Server Actions / Route Handlers

- Route Handlers で認証チェックを必ず行う
- `process.env` からシークレットを読む処理は Server Component または Route Handler に限定する

## HTTP セキュリティ

- セキュリティヘッダーを設定する（CSP、HSTS、X-Frame-Options）
- HTTPS のみ使用する
- オープンリダイレクトを防ぐためにリダイレクト URL を検証する
- 適切な CORS ポリシーを設定する（本番では `FRONTEND_URL` のみ許可）

## 依存パッケージ

- 定期的に `pnpm audit` / `bundle audit` を実行する
- 新しい依存パッケージを追加する前に、メンテナンス状況・ダウンロード数・既知の脆弱性を確認する
- 本番環境ではバージョンを固定する（`pnpm-lock.yaml` / `Gemfile.lock` をコミットする）

## ログ・エラー出力

- ログにシークレット・トークン・パスワードを出力しない
- エラーメッセージやスタックトレースに秘密情報を含めない
- 本番環境では詳細なエラーをクライアントに返さない（ログのみに記録）
