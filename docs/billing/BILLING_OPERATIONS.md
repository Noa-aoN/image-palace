# 課金の運用手順

> 最終更新: 2026-08-15
>
> 記憶ではなく**そのまま実行できる手順**として書く。
>
> **このファイルは git 管理対象。** 秘密情報（API キー・署名シークレット・顧客や決済の id・
> 個人情報）は書かないこと。値は `.env` や Fly のシークレットから読ませる。

関連:
- 仕様の正本 … `docs/billing-credits.md`（値段・期限・無料枠）/ `docs/billing-credit-flow.md`（お金の流れ）
- テストの対応表 … `BILLING_TEST_MATRIX.md`
- 事故と再発防止 … `BILLING_INCIDENTS.md`

**同じことを2か所に書かない**（必ず食い違うため）。仕様を変えたら正本のほうを直す。
この手順書は「どう操作するか」だけを持つ。

---

## 1. Test / Live の切替

### 決まり

`backend/.env` は両方を持ち、`STRIPE_MODE` で選ぶ。判断は `Billing::KeySelection`。

```
STRIPE_MODE=test
STRIPE_TEST_SECRET_KEY=...
STRIPE_TEST_WEBHOOK_SECRET=...
STRIPE_LIVE_SECRET_KEY=          # 手元では通常空でよい
STRIPE_LIVE_WEBHOOK_SECRET=
```

**鍵と署名シークレットは必ず同じモードの組で選ばれる。**
`STRIPE_MODE` を書かなければ従来の名前に落ちる（**Fly の本番はこの形**）。

### 手元で Live を使う（原則やらない）

```
STRIPE_MODE=live
ALLOW_LIVE_STRIPE_LOCALLY=true
```

両方揃わなければ鍵は渡されない（＝課金が起きない）。`1`/`yes` では通らない。
**使い終わったら必ず `STRIPE_MODE=test` に戻す。**

### 反映

```bash
docker compose up -d      # restart では env を読み直さない
```

### 確認（値を出さずに）

```bash
docker compose exec web bin/rails runner '
  sel = Billing::KeySelection.select(env: ENV, local: Rails.env.local?)
  puts "mode=#{sel.mode} refused=#{sel.refused?} test?=#{Billing::Mode.test?}"
  puts "接続: #{Stripe::Balance.retrieve.livemode ? "LIVE" : "test"}"
'
```

---

## 2. プランの同期

モードを切り替えたら必ず流す。**そのモードの商品・値札が作られる。**

```bash
# 手元（Test）
docker compose exec web bundle exec rails stripe:sync_plans

# 本番（Live）
fly machine exec <worker-id> "sh -lc 'cd /app && bundle exec rake stripe:sync_plans'"
```

- 対象は `Plan.active`（`free` を除く）。**並べていない束は同期されない**
- 税コード（`txcd_10000000`）が必ず付く。無いと Checkout の作成が失敗する
- 既存の Price は金額が一致していれば作り直さない

モードを跨いだときは、先に**指し先を空にする**（別モードの id は使えない）。

```ruby
Plan.update_all(stripe_product_id: nil, stripe_price_id: nil)
```

---

## 3. Webhook

**endpoint は `https://api.imagepalace.app/api/v1/stripe/webhook`。**
`/api/v1/billing/webhook` ではない（事故1）。

購読するイベント:
`checkout.session.completed` / `invoice.paid` /
`customer.subscription.updated` / `customer.subscription.deleted` / `refund.created`

**返金の正本は `refund.created`。** `charge.refunded` は購読しない。
あちらは同じ決済に複数回の部分返金があると、毎回**累計額**を持って発火するので、
その回いくら返したのかが読めない。`refund.created` なら「返金1件 = Refund 1件」で数えられる。

### 疎通確認

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://api.imagepalace.app/api/v1/stripe/webhook \
  -H "Content-Type: application/json" -d '{"id":"x","type":"ping"}'
```

**400 が正しい**（署名が無いため拒否）。404 なら URL が違う。

### 手元で受ける（stripe listen）

`stripe listen` が出す署名シークレットは**ダッシュボードのものとは別物**。毎回変わる。

```bash
# 1. 転送を開始（出力の whsec_ を控える）
stripe listen --forward-to http://localhost:3001/api/v1/stripe/webhook

# 2. 控えた値を backend/.env の STRIPE_TEST_WEBHOOK_SECRET に入れる
# 3. docker compose up -d
# 4. 別の端末で投げる
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.updated
```

転送を止めると無効になる。受けない期間はダミー（`whsec_local_dummy`）でよい。

---

## 4. Sandbox E2E

**どこまで自動化できるか**

| 手順 | 自動 | 要るもの |
|---|---|---|
| Checkout Session 作成 | ✓ runner で作れる | — |
| 決済の完了 | ✗ | **ブラウザ**でテストカード入力（`4242 4242 4242 4242`） |
| webhook 受信 | △ | `stripe listen` または `stripe trigger` |
| Portal を開く | ✓ URL は作れる | 中の操作は**ブラウザ** |
| 解約 | ✗ | **ブラウザ**（または API で `cancel_at_period_end` を立てる） |
| 返金 | ✗ | **ダッシュボード** |

**毎回やること**（課金コードを触ったとき）
1. `bundle exec rspec spec/services/billing spec/models/credit_*`
2. Checkout Session が作れること（下記）

```bash
docker compose exec web bin/rails runner '
  user = User.where.not(confirmed_at: nil).first
  %w[topup_10 standard].each do |name|
    plan = Plan.active.find_by(name: name)
    s = Billing::CheckoutSession.call(user: user, plan: plan,
          success_url: "http://localhost:3000/billing", cancel_url: "http://localhost:3000/billing")
    puts "#{name}: url=#{s.url.present?} livemode=#{s.livemode}"
    Stripe::Checkout::Session.expire(s.id)
  end
'
```

**節目でやること**（webhook の経路を変えたとき）— `stripe listen` ＋ `stripe trigger` で
`checkout.session.completed` / `invoice.paid` を流し、台帳が1行だけ増えることを見る。

---

## 5. 本番 smoke の段階

**実決済は毎回やらない。**

| 変更の種類 | やること |
|---|---|
| 通常の変更 | 自動テスト |
| 課金ロジックの変更 | 自動テスト ＋ Sandbox E2E |
| Live 初回切替・大きな課金変更 | 上記 ＋ **本番の実決済 smoke** |

### 本番実決済 smoke のチェックリスト（Live 初回切替で実施した順）

1. 鍵のモードを確認（`mode=LIVE` / 署名シークレットが `whsec_`）
2. 別モードの id を空にする（Plan / 引けない顧客）
3. `sync_plans`。**並んでいる商品だけ**が同期されることを確認
4. webhook の疎通（署名なしで 400）
5. `topup_10`（190円）を実購入
6. 付与が**1回だけ**・期限が3ヶ月・台帳に `livemode=true`・二重付与なし
7. `standard`（1,480円）を実契約 → 契約行・月次付与を確認
8. Portal を開く → 解約 → **即時失効せず期末解約**・DB が Stripe と一致
9. 検証分を返金（ダッシュボード）＋ **手で CR を調整**（下記）
10. 健全性確認（下記）

---

## 6. 手動でクレジットを調整する

返金しても CR は自動で戻らない（事故7）。**台帳に理由を残す。**

```ruby
# 引く先は「実際に付与されたもの」を名指しする。
# 期限の近い順（FEFO）で引くと、別の grant が減って期限の並びが実態とずれる。
user.with_lock do
  grant.update!(remaining_points: 0)                     # 買い切りぶん
  user.update!(subscription_credits: user.subscription_credits - points)  # 月額ぶん
  user.credit_transactions.create!(
    kind: "adjustment", delta: -total,
    description: "◯◯の取り消し（返金に対応）"   # ← あとから理由が分かる形で
  )
end
```

`consume_credits!` は使わない（自前で `consumption` を記録するため、台帳が二重になる）。

---

## 7. 健全性の確認

```ruby
puts "モード: #{Billing::Mode.label}"
puts "引けない顧客: #{User.where.not(stripe_customer_id: [nil, ""]).count { |u|
  begin; Stripe::Customer.retrieve(u.stripe_customer_id); false
  rescue Stripe::InvalidRequestError; true; end }} 人"
puts "負の残高: #{User.where('subscription_credits < 0 OR topup_credits < 0').count}"
puts "1人で2契約: #{Subscription.group(:user_id).having('count(*) > 1').count.size}"
puts "同じ決済 id で2行: #{CreditTransaction.where.not(stripe_event_id: nil)
       .group(:stripe_event_id).having('count(*) > 1').count.size}"
puts "期限切れなのに残る grant: #{CreditGrant.where('expires_at < ? AND remaining_points > 0', Time.current).count}"
```

**すべて 0 が正常。**

---

## 8. 重い処理は worker で

本番で runner や rake を回すときは**必ず worker のマシン**を使う。
app マシンで重い処理を回すと API が詰まる。

```bash
fly machine exec <worker-id> "sh -lc 'cd /app && bin/rails runner /tmp/x.rb'"
```

長い処理は `fly machine exec` のタイムアウトで切れるので、`nohup ... &` で流して
後からログを見る。**デプロイするとマシンが再起動して止まる**ので、走っている間はデプロイしない。


---

## 9. 返金の手順（Refund Runbook）

### 返金の方針

**利用者都合の返金は原則行わない。** ただし次は個別に対応する。

- 二重請求
- 誤請求
- こちら側の重大な不具合・提供不能
- 法令上必要な場合
- その他、運営が合理的に必要と判断した場合

**返金と解約は別の操作。** 返金してもは契約は終わらないし、解約しても返金はされない。
返金の判断は当面すべて人が行う（自動回収はしていない）。

> 海外向けには、日本と同じ返金ルールをそのまま当てない。EU などでは撤回権など
> 別の決まりがあり得るため、海外へ本格展開するときにリージョンごとに決め直す。

### 手順

**1. 受付**
- どの決済についての依頼かを特定する（日時・金額・プラン名）
- 上の「個別に対応する」に当たるかを判断する。当たらなければ、原則どおり断る

**2. Stripe 上の決済を確認**
- ダッシュボードで対象の決済を開く（Live モードであることを確認）
- 金額・日時・顧客・成功しているかを見る
- **すでに返金済みでないか**を必ず確認（二重返金を防ぐ）

**3. 利用状況を確認**

```ruby
user = User.find_by(email: "...")            # または stripe_customer_id から
puts "残高: #{user.available_credit_points / Billing::POINTS_PER_CREDIT} cr"
user.credit_grants.where(kind: "topup").order(:created_at).each do |g|
  puts format("%s  %d/%d cr  期限=%s  決済=%s",
              g.created_at.strftime("%Y-%m-%d %H:%M"),
              g.remaining_points / Billing::POINTS_PER_CREDIT,
              g.amount_points / Billing::POINTS_PER_CREDIT,
              g.expires_at&.strftime("%Y-%m-%d"),
              g.metadata["payment_key"] || "—")
end
```

`payment_key` が、その束を積んだ決済（買い切りなら checkout session の id）。
**返金対象の決済に対応する束**がどれかは、これで分かる。

### ⚠ 辿れる細かさが、買い切りと月額で違う

| | どこまで辿れるか | 何を見るか |
|---|---|---|
| 買い切り | **束（grant）単位** | `credit_grants.metadata["payment_key"]` |
| 月額 | **台帳（transaction）単位まで** | `credit_transactions.stripe_event_id`（請求の id） |

月額は束を作らない（`users.subscription_credits` という1つの入れ物に載る）ため、
「この請求で付いたぶん」を束として切り出せない。解約時に持ち越しへ移した束も、
複数月ぶんが混ざった**合計**であって、特定の請求には対応しない。

将来クレジットの自動回収を作るときは、**この非対称が制約になる**。
買い切りは束を名指しできるが、月額は「いまの残高から引く」形にならざるを得ない。

> `payment_key` は**今後の買い切りだけ**に入る。既存の束には入っていない。

**4. 全額か一部かを決める**

| 状況 | 返金 | クレジット |
|---|---|---|
| 未使用 | 全額 | 束を 0 にする |
| 一部使用 | 全額または未使用分に相当する額 | **残っているぶんだけ**戻す |
| 全部使用済み | 役務は提供済み。**原則返金しない**（不具合が原因なら別） | 触らない |

**残高はマイナスにしない。** 引けないぶんは引かない。

**5. Stripe で返金する**
- ダッシュボードから返金（全額 / 一部）
- **アプリ側では何も起きない。** クレジットは自動で戻らない

**6. 返金が届いたことを確認**

`refund.created` を受けて、台帳に `refund` の行が入り、Sentry に通知が飛ぶ。
鍵は**返金そのものの id**なので、同じ返金は何度届いても1行に収まる。

> **接頭辞を決め打ちしないこと。** Refund の id は `re_...` とは限らない。
> カード以外の経路で作られた Charge（`py_...`）に対応する返金は `pyr_...` になる。
> 実際、本番の初回確認（2026-08-16）で届いたのは `pyr_` だった。
> コードは `refund[:id]` をそのまま鍵にしているので影響しないが、
> **確認スクリプトや手順で「`re_` で始まるはず」と書かない。**

```ruby
CreditTransaction.where(kind: "refund").order(:created_at).last
# => description に 金額 / 全額か一部か / charge・payment_intent・invoice の id
```

**行が無ければ webhook が届いていない。** endpoint と購読イベントを確認する（§3）。

**7. クレジットを手で調整する（必要な場合のみ）**

§6 の手順に従う。**引く先は名指しする**（期限の近い順で引くと別の束が減る）。
理由は必ず残す。

```ruby
user.with_lock do
  grant.update!(remaining_points: 0)
  user.credit_transactions.create!(
    kind: "adjustment", delta: -points,
    description: "返金に伴う取り消し（charge=ch_xxx）"
  )
end
```

**8. 契約について**

返金しただけでは契約は続く。終わらせたいなら、**別の操作として**
お支払い管理ページから解約する（期末解約になる）。

**9. 最終確認**

```ruby
puts "残高: #{user.reload.available_credit_points / Billing::POINTS_PER_CREDIT} cr"
puts "負の残高: #{User.where('subscription_credits < 0 OR topup_credits < 0').count}"   # 0 であること
puts "返金の行: #{CreditTransaction.where(kind: 'refund').count}"
puts "調整の行: #{CreditTransaction.where(kind: 'adjustment').count}"
```

---

## 10. 売上と返金の見せ方（設計メモ・未実装）

いまの `Admin::FinanceService#revenue_jpy` は `amount_cents` をそのまま合計する。
**返金の行には `amount_cents` を入れていない**ので、既存の数字は返金前のまま
（＝ Gross Revenue）で、意味は変わっていない。

将来、返金を差し引いた額まで出すときの形。

| 指標 | 出し方 |
|---|---|
| Gross Revenue | いまの `revenue_jpy`（`amount_cents` の合計・`livemode: true`） |
| Refunds | `kind: "refund"` の返金額の合計。**いまは列に入れていない**ので、
入れるなら `amount_cents` に負で持たせるか、専用の列を足す |
| Net Revenue | Gross − Refunds |
| Stripe fees | `Billing::Catalog::STRIPE_FEE_RATE`（3.6%）。実額は Stripe の残高明細が正 |
| Gross Profit | Net Revenue − 手数料 − 画像の原価 |

**気をつけること** — 返金額を `amount_cents` に負で入れると、
`revenue_jpy` が黙って Net に変わる。既存の数字の意味が変わるので、
入れるときは同時に Gross / Refunds / Net を分けて出すこと。


---

## 11. 返金が後から失敗した場合（Later・未購読）

Stripe の返金は、決済手段によっては**後から失敗する**ことがある
（`refund.updated` / `refund.failed`）。いまはどちらも購読していない。

### いまの台帳は、その更新に耐えるか

**耐える。** 理由は、`refund.created` を受けた時点で**残高を1点も動かしていない**から。

自動回収していれば、失敗したときに戻した分を戻し直す必要があり、
「戻した／やっぱり戻っていない」の二重管理になる。それをしていないので、
返金が失敗しても**辻褄を合わせる作業が発生しない**。台帳の行は
「その時点で返金が作られた」という事実として、そのまま正しい。

受け取った時点の `status` を `description` に残してあるので、
後から「pending で受けたものが最終的にどうなったか」を追える。

### 将来購読するときの注意

鍵が `refund.id` なので、**同じ返金の `refund.updated` は一意制約に弾かれて
黙って捨てられる**。状態の更新を拾いたいなら、次のどちらかが要る。

- 別の鍵で行を足す（例: `re_xxx:failed`）。台帳は追記だけで済む
- 既存行の `description` を書き換える。履歴は残らない

**前者を勧める**。お金の記録は、書き換えるより積むほうが後から読める。
