# ADR: OAuth 認証設計 - 単一テーブル vs 認証テーブル分離

- **日付**: 2026-03-27
- **ステータス**: 承認済み
- **決定者**: チーム

---

## コンテキスト

devise + devise_token_auth で動作している Rails API に Google OAuth（omniauth-google-oauth2）を統合するための認証設計を決定する必要がある。

要件：
- メール認証は既に実装済み
- Google OAuth でログイン可能にする
- 将来的に他のSNS（LINE、Facebookなど）を追加する可能性がある
- devise_token_auth のトークン認証を維持する

---

## 検討した選択肢

### Pattern A: 単一テーブル（採用）

```
users テーブルに provider, uid カラムを持つ設計
```

**メリット**:
- 実装がシンプル
- 既存スキーマの変更が不要
- devise_token_auth の標準対応
- マイグレーションが不要

**デメリット**:
- 1ユーザー = 1認証手段（メール + Google 同時使用不可）
- 後から他のSNSを追加する場合、スキーマ変更が必要
- メールアドレス変更時に認証が壊れる可能性

### Pattern B: 認証テーブル分離（見送り）

```
users テーブル（基本情報） + user_authentications テーブル（認証情報）に分ける設計
```

**メリット**:
- 1ユーザー = N認証手段（メール + Google + LINE など）
- メールアドレスが変わっても Google UID で識別可能
- 後から他のSNSを追加しやすい
- Firebase Auth / Auth0 併用時にも適している

**デメリット**:
- マイグレーションが必要（user_authentications テーブル作成）
- 実装がやや複雑（関連モデル追加）
- devise_token_auth のカスタマイズが必要

---

## 決定

**Pattern A（単一テーブル）を採用**

- 実装がシンプル
- 既存スキーマの変更が不要
- MVP リリース前のため、まずはシンプルな設計で実装
- 認証手段はメールとGoogleのみを想定

---

## 理由

1. **MVP 優先**: 複雑な設計より、まずはシンプルな実装でリリース
2. **既存データ保護**: マイグレーション不要で、既存ユーザーに影響なし
3. **devise_token_auth 標準**: カスタマイズ不要で、標準機能で動作
4. **移行コスト**: Pattern A → Pattern B への移行は可能（後述）

---

## セキュリティ上の重要な決定

### email一致による自動統合は行わない

**理由**: 誰かが他人のメールアドレスを知っているだけでアカウントにアクセスできるリスクを回避

**実装**:
```ruby
def self.find_for_oauth(auth_hash)
  # provider + uid のみで検索
  user = find_by(provider: auth_hash['provider'], uid: auth_hash['uid'])

  if user
    user
  else
    # 見つからない場合は新規作成
    create!(...)
  end
end
```

### バリデーション

```ruby
validates :uid, uniqueness: { scope: :provider }
```

---

## 結果・影響

- **User モデル**: `omniauthable` モジュールと `find_for_oauth` メソッドを追加
- **OmniAuth コールバック**: `api/v1/auth/omniauth_callbacks_controller.rb` を新規作成
- **ルーティング**: `mount_devise_token_auth_for` にカスタムコントローラーを紐付け
- **環境変数**: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` を追加

---

## 追記: OAuthトークンのURLフラグメント渡し（2026-04-06）

OAuthコールバック後、フロントエンドへのトークン受け渡し方法を変更した。

### 変更前（問題のある実装）

```
https://example.com/auth/callback?access-token=xxx&uid=yyy
```

クエリパラメータ（`?`）でトークンを渡していたため、サーバーログやブラウザ履歴にトークンが残るリスクがあった。

### 変更後（採用）

```
https://example.com/auth/callback#access-token=xxx&uid=yyy
```

URLフラグメント（`#`）でトークンを渡すことで、サーバーには送信されず、ブラウザのみで処理される。

- 関連コミット: `fix: OAuthトークンをURLフラグメントで渡すよう変更しセキュリティを改善する` (#66)
- セキュリティルール: `.claude/rules/security.md` にも明記

---

## 将来の方針

### Pattern B に移行する判断基準

以下のいずれかを満たしたら、Pattern B（認証テーブル分離）への移行を検討：

1. **3つ以上の認証手段を追加する場合**
2. **Google OAuth 以外のソーシャルログイン要望が複数出た場合**
3. **メールアドレス変更機能の実装が必要になった場合**
