# 課金のテスト対応表

> 最終更新: 2026-08-15（Live 課金 E2E 完了時点）
>
> **このファイルは git 管理対象。** 秘密情報（API キー・署名シークレット・顧客や決済の id・
> 個人情報）は書かないこと。書いてよいのは、公開ドメインと Stripe が公表している値まで。

## 読み方

各項目は「**何をもって PASS とするか**」を書いてある。チェックだけでは、
あとから見て「何を確かめたのか」が分からなくなる。

| 記号 | 意味 |
|---|---|
| 自動 | RSpec で毎回走る。壊れたら CI（または手元の全体実行）で落ちる |
| Sandbox | Test の Stripe で再現できる。課金は起きない |
| 本番 | Live の実決済が要る。**毎回はやらない**（→ `BILLING_OPERATIONS.md` の段階） |

---

## Top-up（買い切り）

| 項目 | 期待仕様（PASS の条件） | 自動 | Sandbox | 本番 | 関連 |
|---|---|:--:|:--:|:--:|---|
| Checkout 作成 | `session.url` が返り、`mode=payment`。税コードの無い商品では作成が失敗する | ✓ | ✓ | 初回のみ | `Billing::CheckoutSession` |
| 決済完了 | `checkout.session.completed` が 2xx で受理される | — | ✓ | 初回のみ | `StripeWebhooksController` |
| CR 付与 | 台帳に `topup_purchase` が**1行だけ**。額はプランの `credits_per_period` | ✓ | ✓ | 初回のみ | `webhook_handler_spec` |
| 3ヶ月期限 | 付与された `credit_grant.expires_at` が**付与日 +3ヶ月**（±1日） | ✓ | ✓ | 初回のみ | `credit_expiry_policy_spec` |
| webhook 再送 | 同じ session を再送しても残高が動かない | ✓ | ✓ | — | `webhook_handler_spec`「冪等性」 |
| 二重付与防止 | 鍵は **checkout session の id**。webhook と戻り先の取り込みが同じ鍵を使う | ✓ | ✓ | 初回のみ | `checkout_sync_service_spec` |
| `credit_transactions` | `livemode` / `amount_cents` / `currency` / `stripe_event_id` が入る | ✓ | ✓ | 初回のみ | 同上 |
| 返金時の挙動 | **CR は自動で戻らない**（`charge.refunded` は未購読）。手で調整する | — | — | — | → `BILLING_INCIDENTS.md` |

## Subscription（月額）

| 項目 | 期待仕様（PASS の条件） | 自動 | Sandbox | 本番 | 関連 |
|---|---|:--:|:--:|:--:|---|
| 新規契約 | `Subscription` が1行できて `status=active`・`plan` が一致 | ✓ | ✓ | 初回のみ | `subscription_sync_spec` |
| 月次 CR 付与 | `invoice.paid` で当月分にリセット付与。台帳は `subscription_grant` | ✓ | ✓ | 初回のみ | `webhook_handler_spec` |
| `invoice.paid` 再送 | 同じ event id では増えない | ✓ | ✓ | — | 同上 |
| Customer Portal | Portal の URL が返る | — | ✓ | 初回のみ | `PortalsController` |
| 期末解約 | `status` は `active` のまま。**即時失効しない** | ✓ | ✓ | 初回のみ | `subscription_sync_spec` |
| `cancel_at` | 真偽値が false でも `cancel_at` があれば解約予定として扱う | ✓ | ✓ | 初回のみ | 同上（**事故4の再発防止**） |
| `cancel_at_period_end` | 真偽値が立っていれば解約予定 | ✓ | ✓ | — | 同上 |
| 契約終了 | `customer.subscription.deleted` で `status=canceled` | ✓ | ✓ | — | `cancel_keeps_credits_spec` |
| **終了後も既存 CR が使える** | 残りは持ち越しの grant へ移り、`expires_at` まで使える | ✓ | ✓ | — | 同上（**事故5の再発防止**） |
| 終了後は月次付与なし | `users.subscription_credits` が 0 のまま | ✓ | ✓ | — | 同上 |
| 再契約 | 旧 grant と新しい月次分が**両方**使える | ✓ | ✓ | — | 同上 |
| FEFO との共存 | 期限の近い grant から先に減る | ✓ | ✓ | — | 同上 |
| topup への影響 | 買い切りの grant は減らない | ✓ | ✓ | — | 同上 |

## Refund（返金）

| 項目 | 現状（PASS の条件） | 自動 | Sandbox | 本番 |
|---|---|:--:|:--:|:--:|
| topup 返金 | Stripe 側で返金できる。**CR は自動で戻らない** | — | ✓ | — |
| subscription 返金 | 同上。契約の状態は変わらない | — | ✓ | — |
| 返金と解約は別物 | 返金しても解約されず、解約しても返金されない | — | ✓ | — |
| **返金の検知** | **`refund.created`** を受け、台帳に `refund` を残して運営へ通知 | ✓ | ✓ | ✓ |
| 冪等性の鍵 | **`refund.id`**。イベントの id ではない。**接頭辞は決め打ちしない**（`re_` / `pyr_` など決済経路で変わる） | ✓ | ✓ | — |
| 部分返金 | その回の額を記録（`charge.refunded` の累計額ではない） | ✓ | ✓ | — |
| status の保持 | 受け取った時点の `status` を残す（後から失敗しうるため） | ✓ | — | — |
| 返金でCRを動かさない | **残高も束も契約も変わらない**（自動回収はしない） | ✓ | ✓ | — |
| 同じ返金の再送 | 行が増えない（`stripe_event_id` の一意制約） | ✓ | ✓ | — |
| 宛先不明の返金 | 落ちずに通知だけ残す（台帳には書かない） | ✓ | ✓ | ✓ |
| 自動回収 | **していない**。手で `adjustment` を記録して調整する | — | — | — |

> 返金の手順は `BILLING_OPERATIONS.md` §9（Refund Runbook）。台帳に理由を残すこと。
> 売上と返金の見せ方（Gross / Refunds / Net）は同 §10 の設計メモ。**未実装。**

## Environment（環境の取り違え）

| 項目 | 期待仕様（PASS の条件） | 自動 | Sandbox | 本番 |
|---|---|:--:|:--:|:--:|
| `STRIPE_MODE` | 書けばその組、書かなければ従来の名前に落ちる | ✓ | ✓ | ✓ |
| 手元で Live を使わない | 鍵を渡さない（＝課金が起きない）。理由をログに残す | ✓ | ✓ | — |
| 逃げ道 | `ALLOW_LIVE_STRIPE_LOCALLY=true` のときだけ通る。`1`/`yes` では通らない | ✓ | — | — |
| Product ID のモード一致 | `Stripe::Product.retrieve(...).livemode` が環境と一致 | — | ✓ | ✓ |
| Price ID のモード一致 | 同上 | — | ✓ | ✓ |
| **Customer ID のモード一致** | 引けない顧客は作り直す | ✓ | ✓ | ✓ |
| Webhook secret のモード一致 | 鍵と同じ組から選ばれる | ✓ | ✓ | ✓ |
| データ混在防止 | 台帳の `livemode` で見分けられる | ✓ | — | ✓ |

## Webhook

| 項目 | 期待仕様（PASS の条件） | 自動 | Sandbox | 本番 |
|---|---|:--:|:--:|:--:|
| endpoint URL | **`/api/v1/stripe/webhook`**（`/billing/webhook` ではない） | — | ✓ | ✓ |
| `refund.created` | 返金を記録して通知。**CRは動かさない** | ✓ | ✓ | ✓ |
| `charge.refunded` | **購読しない**（届いても何もしない） | ✓ | — | — |
| 署名成功 | 2xx。台帳に `stripe_event_id` が入る | ✓ | ✓ | 初回のみ |
| 署名失敗 | 400。**処理しない**。ログに理由（値は出さない） | ✓ | ✓ | ✓ |
| 再送 | 同じ鍵では残高が動かない | ✓ | ✓ | — |
| `checkout.session.completed` | 買い切りを付与 | ✓ | ✓ | 初回のみ |
| `invoice.paid` | 月次分をリセット付与 | ✓ | ✓ | 初回のみ |
| `customer.subscription.updated` | 解約予約・プラン変更を写す | ✓ | ✓ | 初回のみ |
| `customer.subscription.deleted` | 終了扱い。**CR は没収しない** | ✓ | ✓ | — |
| 宛先不明 | `UNMATCHED` として記録し、黙って捨てない | ✓ | ✓ | ✓ |

## Credits

| 項目 | 期待仕様（PASS の条件） | 自動 | Sandbox | 本番 |
|---|---|:--:|:--:|:--:|
| 付与から3ヶ月 | 出どころによらず `CreditExpiryPolicy::LIFETIME` | ✓ | — | ✓ |
| FEFO | 期限の近いものから減る。同着は古い付与から | ✓ | — | — |
| 期限切れ除外 | `CreditGrant.active` が残高から外す | ✓ | — | ✓ |
| 解約時に没収しない | 持ち越しへ移り、期限まで使える | ✓ | ✓ | — |
| 再契約で旧 grant を壊さない | 旧 grant の残高が変わらない | ✓ | — | — |
| duplicate grant 防止 | 同じ決済の鍵で2行にならない | ✓ | ✓ | ✓ |
| negative balance 防止 | 残高不足なら `InsufficientCredits` | ✓ | — | ✓ |
| 期限前のお知らせ | 失効の**7日前・1日前**に1度ずつ。同じ節目で二度鳴らさない | ✓ | — | ✓ |

---

## 最終確認日

| 範囲 | 日付 | 方法 |
|---|---|---|
| 自動テスト全体 | 2026-08-15 | `bundle exec rspec`（2100+ examples） |
| Sandbox E2E | 2026-08-15 | Test 鍵で `sync_plans` ＋ Checkout 作成（topup / subscription） |
| Live E2E | 2026-08-15 | topup_10 実決済 → standard 実契約 → Portal → 期末解約 |
| 本番の健全性 | 2026-08-15 | 混在なし・重複なし・負の残高なし |
