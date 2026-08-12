# Passkey / WebAuthn の設計

管理者認証を Passkey 中心へ寄せるための土台。段階的に入れる。

```
第一選択  Passkey / WebAuthn   … Touch ID・Face ID・Windows Hello・セキュリティキー
fallback  TOTP                 … 認証アプリ（実装済み）
最終      復旧コード            … どちらも失ったとき（実装済み）
```

**既存の TOTP は消さない。** Passkey は端末に紐づくので、端末を失うと使えない。
TOTP は機種変更で移せる。役割が違う。

---

## 1. RP ID は後から変えられない（最重要）

| | 値 |
|---|---|
| `WEBAUTHN_RP_ID` | `imagepalace.app`（**apex**） |
| `WEBAUTHN_ORIGIN` | `https://imagepalace.app` |

**RP ID を変えると、登録済みの鍵がすべて無効になる。** 認証器は「どのドメインの鍵か」を
RP ID で覚えており、名前が変われば別物として扱う。利用者から見ると、ある日いきなり
Passkey が消える。

apex にしてあるので、サブドメインを足してもこの値は変えなくてよい。逆に
`api.imagepalace.app` にすると、apex のフロントから登録できない。

```
フロント: https://imagepalace.app       ← ここから呼ばれる（origin はこれ）
API:      https://api.imagepalace.app   ← ここが検証する
```

**origin は「呼んだ画面のアドレス」。API のアドレスではない。** 取り違えると検証が必ず失敗する。

手元では `localhost` / `http://localhost:3000`（初期化ファイルの既定値）。
https でなくても、localhost だけは例外として扱われる。

---

## 2. DB

```
users.webauthn_id            認証器へ渡す目印（内部の利用者IDを渡さない）
webauthn_credentials         登録した鍵。1人が何本でも持てる
webauthn_challenges          challenge。短命・1回きり・用途つき
```

### user handle に内部IDを使わない

user handle は**認証器に保存され、端末を持つ人から読めることがある**。
内部の利用者IDをそのまま渡すと、そこから利用者数や登録順が推し量れる。
`SecureRandom.uuid` を別に持ち、必要になった時点で作る。

### challenge を Rails.cache に置かない

本番の `Rails.cache` は **FileStore（`/app/tmp/cache/`）** で、マシンのローカルディスク。
他のマシンからは見えない。

いま app 機は1台なので動くが、**2台に増やした瞬間、challenge を配った機と検証する機が
食い違って認証が通らなくなる**。だから最初から DB に置く。

（同じ理由で、TOTP の試行回数制限は2台構成で緩む。別課題として記録済み）

### challenge の使い捨ては競合に強い形で

判定してから更新する書き方だと、同時に来た2つが両方「まだ使われていない」を見て、
**両方とも通る**。UPDATE の WHERE に「まだ使われていない」を入れ、**1行更新できた側だけ**を
成功にする。更新できた行数はデータベースが数えるので、割り込む隙がない。

```ruby
updated = usable.where(id: record.id).update_all(consumed_at: Time.current)
updated == 1 ? record : nil
```

---

## 3. 自前で書かないもの

**署名検証・COSE 鍵の解釈・端末証明の検証は `webauthn` gem に任せる。**
間違えても動いてしまう類の処理で、間違いに気づけない。

### sign_count に独自の判定を足さない

素朴に「増えていなければ複製」と決めつけると、**正規の利用者を弾く**。
同期する Passkey は複数の端末で使われ、数え方が実装によって違う（0 のままのものもある）。
扱いは gem の現行の推奨に従い、こちらでは記録するだけにする。

---

## 4. 段階

| | 内容 | 状態 |
|---|---|---|
| C-1 | gem・migration・モデル。**エンドポイントは生やさない** | 済 |
| C-2 | 登録（`/account` から追加・一覧・削除）。**UI は admin 限定** | — |
| C-3 | 危険操作の再認証を Passkey 第一・TOTP fallback に | — |
| C-4 | ログイン自体を Passkey で | **当面やらない** |

DB と API は**将来の全利用者向け**に作る。UI の公開だけを admin に絞る。

C-4 はログイン経路に触れるので、締め出しの危険が最も大きい。しばらく寝かせる。

---

## 5. 締め出しを防ぐ

| 策 | 内容 |
|---|---|
| `ADMIN_EMAILS` の逃げ道 | **最重要。** ここは Passkey も TOTP も求めない |
| 鍵は複数登録できる | 1本だと、その端末を失った時点で入れなくなる。2本目を促す |
| TOTP を残す | 端末を失っても、認証アプリで入れる |
| 復旧コード | どちらも失ったとき |
| rake task | `admin:reset_totp[email]`（Passkey 版は C-2 で足す） |
| 必須化しない | ログイン自体は従来どおり |

---

## 6. 運用で気をつけること

- **登録は必ず認証済みの状態で行う。** 可能なら登録時にも再認証を求める
- 認証の入口にも Rack::Attack のスロットルを付ける（C-2 で）
- ブラウザが非対応なら TOTP へ誘導する（`browserSupportsWebAuthn()`）
- 期限切れの challenge は定期的に掃除する（`WebauthnChallenge.sweep!`）
