# 認証・セキュリティ方針（本リリース時点）

最終更新: 2026-08-12

本リリース時点で確定した認証の姿と、将来の課題を残す。
**新しい認証機能はここで一旦止める。** 追加は「発火条件」を満たしてから。

---

## 1. 一般ユーザー

### ログイン方法

| 方法 | 状態 |
|---|---|
| Google | **稼働中** |
| メールアドレス + パスワード | **稼働中**（確認メールあり） |
| Apple | 実装済み・**本番では未開放**（下記 §5） |

### 必須化しないもの

- Passkey
- TOTP（認証アプリ）
- Recovery Code
- Strong Auth

**低摩擦を優先する。** 学習アプリで、入るたびに手間が増えると続かない。
守るべき情報の重さ（自分の作ったカード）と、手間の重さが釣り合っていない。

### セキュリティ画面

一般ユーザーには**出さない**。

中身がパスキーと二要素認証だけで、どちらも運営の運用のためのもの。
使わせないものを見せると、設定し忘れているのかを毎回考えさせてしまう。

一般ユーザーに必要な項目は、既に別の場所にある。

| 項目 | 場所 |
|---|---|
| メールアドレス | アカウント管理 → 登録情報 |
| ログイン連携（Google / Apple / メール） | アカウント管理 → 登録情報 |
| アカウント削除 | アカウント管理 → 退会 |

一般向けの項目（連携の管理・端末の一覧など）を足すときは、
`SecuritySettings` の出し分けを**項目ごとに移す**（画面ごと隠すのをやめる）。

---

## 2. 運営（admin）

```
Google / Apple / メール
        ↓ 一次認証
   運営かどうかの判定
        ↓
    Strong Auth ← Passkey / TOTP / Recovery Code のいずれか
        ↓
      /admin
```

- 判定は毎リクエスト、サーバー側で行う（`Api::V1::Admin::BaseController`）
- 通った記録は**端末（devise-token-auth の client）ごと**。猶予10分
- 別の端末で確かめても、こちらは開かない
- **恒久的なバイパスは無い。** `ADMIN_EMAILS` で入った人にも Strong Auth を求める

### 栓（Feature Flag）

| 変数 | 既定 | 効果 |
|---|---|---|
| `ADMIN_STRONG_AUTH_ENABLED` | `false` | `true` で運営に強い確認を求める |
| `PASSKEY_ENABLED` | `true` | `false` でパスキーの口を閉じる（登録済みの鍵は消さない） |

`ADMIN_STRONG_AUTH_ENABLED` は **fly secrets が唯一の設定元**。
`fly.toml` の `[env]` には置かない（secret が [env] より強いため、両方に書くと食い違う）。

```bash
fly secrets set ADMIN_STRONG_AUTH_ENABLED=true    # 入にする
fly secrets set ADMIN_STRONG_AUTH_ENABLED=false   # 戻す（デプロイ不要）
```

いまの値と出どころは `rails auth:admin_readiness` が出す。

---

## 3. 運営が締め出されたときの復旧手順

**前提: 執務室（/admin）に入れないだけで、ログインとアカウント設定は開く。**
まず自分で戻れないか試す。

### 手順1: 自分で戻る（推奨）

1. 通常どおりログインする
2. アカウント管理 → セキュリティ を開く
3. パスキーを登録し直す、または認証アプリを設定する
4. `/admin` へ戻る

### 手順2: 復旧コードを使う

認証アプリの端末を失ったが復旧コードが手元にある場合、
Strong Auth の画面でコードを入れる（**使い捨て**。1本使うと消える）。

### 手順3: 栓を倒す（全員が入れないとき）

```bash
fly secrets set ADMIN_STRONG_AUTH_ENABLED=false
```

デプロイ不要。これで一次認証だけで入れる状態へ戻る。
原因を直したら `true` に戻す。

### 手順4: 手立てを消す（端末を完全に失ったとき）

worker マシンで実行する（app で重い処理を回すと本番が止まる）。

```bash
fly machine exec <worker-machine-id> "bash -lc 'cd /app && bundle exec rails auth:reset_strong_auth[メールアドレス]'"
```

パスキーと認証アプリの登録を消す。**消したあと、本人が登録し直すまで
Strong Auth は通らない**ので、`ADMIN_STRONG_AUTH_ENABLED=false` と併せて使う。

### 確認

```bash
fly machine exec <worker-machine-id> "bash -lc 'cd /app && bundle exec rails auth:admin_readiness'"
```

誰が手立てを持っているか、栓を入にして困る人がいないかを出す。
**秘密そのもの（TOTP の鍵・復旧コード・パスキーの中身）は出さない。**

---

## 4. 権限の判定（ADMIN_EMAILS と DB role）

いまは**2つの経路が併存している**。

| 経路 | 中身 |
|---|---|
| `users.role` | `user` / `support` / `operator` / `admin` の4段階。**本来の正** |
| `ADMIN_EMAILS` | 入口＋逃げ道。ここに載っていて確認済みなら `admin?` が真になる |

**2026-08-12 時点の本番: `role` が上位の人は0人。運営はすべて `ADMIN_EMAILS` 経由。**

`ADMIN_EMAILS` は「DB を触れない状況でも運営が入れる」ための逃げ道として作った。
ただし2つの真実があるのは危うい。将来は `role` へ寄せる（Issue に記載）。

**移行時にやってはいけないこと**: `ADMIN_EMAILS` を先に外すこと。
`role` を立て、`admin?` が真であることを確かめてから外す。

---

## 5. Apple ログイン

実装は済んでいるが、**本番では開いていない**。

### いまの状態

| 項目 | 状態 |
|---|---|
| omniauth 設定（`config/initializers/devise.rb`） | 実装済み |
| callback（`OmniauthCallbacksController`） | Google と共通。実装済み |
| ボタンの表示 | `NEXT_PUBLIC_APPLE_AUTH_ENABLED` が `true` のときだけ。**本番は未設定 = 非表示** |
| Fly secrets | `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` すべて**未設定** |
| 未設定時の挙動 | `/omniauth/apple` はサインイン画面へ戻る（**エラーにはならない**） |

### 開くために要るもの

1. **Apple Developer 側**（コードでは済ませられない）
   - Services ID の作成（= `APPLE_CLIENT_ID`）
   - Return URL に `https://api.imagepalace.app/omniauth/apple/callback` を登録
   - Sign in with Apple 用の鍵（.p8）を作り、Key ID と Team ID を控える
   - ドメイン検証（`imagepalace.app`）
2. **Fly secrets を4つ設定**（`APPLE_PRIVATE_KEY` は .p8 の中身。改行は `\n` で可）
3. **`NEXT_PUBLIC_APPLE_AUTH_ENABLED=true`** でフロントを再デプロイ
4. 実機確認（Apple ID でのログイン → カード一覧まで）

### 開く前に決めておくこと

- **private relay メール**: Apple は `@privaterelay.appleid.com` を返すことがある。
  いまの実装はそのまま保存する。届かないメールになるので、
  お知らせメールを送る導線ができたら扱いを決める必要がある
- **名前は初回だけ**: Apple は2回目以降 name を返さない。
  いまの実装は `uid` で既存ユーザーを引くので、再ログインは問題ない
- **同じメールの別経路**: いまの `find_for_oauth` は `provider + uid` だけで引き、
  無ければ作る。メールで登録済みの人が Apple で入ると**別アカウントになる**
  （Google も同じ挙動で、既に本番で起きうる）。Issue に記載

---

## 6. 一般ユーザーへの Passkey 展開（将来）

**今回は実装しない。**

### 想定する姿

| 状態 | ログイン方法 |
|---|---|
| Passkey 未登録 | Google / Apple / メール |
| Passkey 登録済み | Passkey / Google / Apple / メール（**どれでも**） |

既存のログインを壊さず、速くて安全な選択肢を**足す**。
さらに先では Passkey による直接サインアップも考えられる。

### 発火条件（どれかが起きたら着手する）

- ログインの手間が、離脱の原因としてはっきり見えた
- 一般ユーザーから要望が出た
- パスワード依存を減らす必要が出た
- アカウント乗っ取りへの対策強化が必要になった
- ネイティブアプリを出す
- 利用者数が増え、サポート対応の負荷が上がった

それまでは、DB・API を汎用構造のまま置いておく（`webauthn_credentials` は
`user_id` に紐づくだけで、運営専用の作りにはなっていない）。

---

## 7. 今回やらないと決めたこと

重さの割に、いまの規模では得るものが小さい。Issue へ送った。

- ログイン中の端末の一覧
- 他の端末からログアウト
- 端末の細かい管理
- 高度な監査 UI

いま運営は1人で、パスキーと復旧コードで戻れる。
人が増えたら作る。
