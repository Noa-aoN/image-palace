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

## 将来の方針

### Pattern B に移行する判断基準

以下のいずれかを満たしたら、Pattern B（認証テーブル分離）への移行を検討：

1. **3つ以上の認証手段を追加する場合**
   - LINE、Facebook、GitHub など、複数のソーシャルログイン要望が出た場合

2. **Google OAuth 以外のソーシャルログイン要望が複数出た場合**
   - ユーザーからの要望が3件以上、または重要度が高い場合

3. **メールアドレス変更機能の実装が必要になった場合**
   - ユーザーがメールアドレスを変更しても、Google UID で認証を維持する必要がある場合

### Pattern B への移行手順（将来）

1. **user_authentications テーブル作成**
   ```ruby
   create_table :user_authentications do |t|
     t.uuid :user_id, null: false
     t.string :provider, null: false
     t.string :uid, null: false
     t.string :password, null: false  # provider='email' のみ使用
     t.timestamps

     t.index [:provider, :uid], unique: true
     t.index :user_id
     t.foreign_key :user_id, :users
   end
   ```

2. **既存データの移行**
   - users テーブルから user_authentications テーブルへデータをコピー
   - provider='email' のユーザー: password を移行
   - provider='google_oauth2' のユーザー: uid を移行

3. **モデルの関連付け**
   ```ruby
   class User < ApplicationRecord
     has_many :user_authentications, dependent: :destroy
   end

   class UserAuthentication < ApplicationRecord
     belongs_to :user
     validates :uid, uniqueness: { scope: :provider }
   end
   ```

4. **認証ロジックの変更**
   - `find_for_oauth` メソッドを user_authentications テーブルで検索するように変更

5. **users テーブルのカラム削除**
   - provider, uid, encrypted_password カラムを削除（バックアップを取ってから）

---

## トレードオフ

| 項目 | Pattern A（現状） | Pattern B（将来） |
|------|------------------|------------------|
| 実装コスト | 低 | 中 |
| マイグレーション | 不要 | 必要 |
| 拡張性 | 低 | 高 |
| 認証手段 | 1つのみ | 複数可能 |
| メール変更時の影響 | 認証が壊れる可能性 | UIDで識別可能 |

---

## 実装済み: フロントエンド連携フロー

> 2026-04-02 実装完了

### OAuth フロー

```
1. ユーザーが「Googleでログイン」ボタンをクリック
   → window.location.href = `${NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/google_oauth2`

2. Google 認証画面 → 許可

3. バックエンドが `FRONTEND_URL/auth/callback?token=xxx&...` にリダイレクト
   （URI.parse でスキーム・ホストを検証済み）

4. フロントエンドの /auth/callback ページがクエリパラメータからトークンを取得
   → validate_token で検証 → Zustand ストアに保存 → dashboard へ遷移
```

### 環境変数

| 変数 | ローカル | 本番 |
|-----|---------|------|
| `FRONTEND_URL` | `http://localhost:3000` | `https://image-palace-frontend.image-palace.workers.dev` |
| `GOOGLE_OAUTH_CLIENT_ID` | `.env` | Fly.io secrets |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `.env` | Fly.io secrets |

Google Cloud Console の「承認済みのリダイレクト URI」:
- `https://image-palace-api.fly.dev/omniauth/google_oauth2/callback`

---

## 関連ファイル

- `backend/app/models/user.rb`
- `backend/app/controllers/api/v1/auth/omniauth_callbacks_controller.rb`
- `frontend/src/app/(auth)/auth/callback/page.tsx`
