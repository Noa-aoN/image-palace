# 課金・クレジット フロー リファレンス

> 最終更新: 2026-06-30 ／ 実装の正本はコード、本書は「責務と挙動の明文化」。仕様は RSpec で固定（[[billing-credit-test-plan]]）。
> 関連: `docs/decisions/credit-model.md`（設計判断）、`docs/decisions/semantic-search.md`、[[stripe-billing-progress]]

主要ファイル：
- `app/services/billing/webhook_handler.rb` … Stripe Webhook の振り分け・冪等化・付与
- `app/models/user.rb` … クレジット残高/付与/消費の本体
- `app/models/credit_grant.rb` / `credit_transaction.rb` / `subscription.rb` / `plan.rb`
- `app/jobs/expire_credit_grants_job.rb` … 期限切れグラントの失効（日次）
- `app/controllers/api/v1/billing/*` … checkout / portal / summary / plans
- `app/controllers/api/v1/stripe_webhooks_controller.rb` … 受け口（署名検証→422でStripeにリトライさせる）

---

## 1. クレジット種別と役割
内部単位は **ポイント（1cr = `Billing::POINTS_PER_CREDIT=100`pt）**。`available_credits` は合算表示。

| 種別 | 保持先 | 期限 | 繰り越し | 役割 |
|---|---|---|---|---|
| **期限付きグラント** | `credit_grants`（`remaining_points`/`expires_at`） | あり（`expires_at`）／`nil`=無期限 | 期限内のみ | Free引き継ぎ・キャンペーン・お詫び |
| **サブスク枠** | `users.subscription_credits` | 実質月次（更新で上書き） | しない（毎周期リセット） | 月間プラン枠・無料枠 |
| **Top-up** | `users.topup_credits` | なし | 恒久加算 | 買い切りチャージ |

- 有効グラント = `remaining_points > 0 AND (expires_at IS NULL OR expires_at > now)`（`CreditGrant.active`）。
- `available_credit_points = Σ(有効グラント remaining) + subscription_credits + topup_credits`。

## 2. 付与タイミング
- **グラント**：`User#grant_credits!(amount, kind:, expires_at:)`。発生源＝Free→Paid carryover（自動）／`rake credits:grant`（キャンペーン・お詫び）／将来の webhook。
- **サブスク枠**：有料は `invoice.paid` → `reset_subscription_credits!(plan枠)`（**上書き**、旧残は失効ログ）。無料は参照時 `ensure_current_period_credits!` が登録日アニバーサリー基準で月次 lazy 付与（active 有料sub が無い時のみ）。
- **Top-up**：`checkout.session.completed`(mode=payment) → `add_topup_credits!`（**加算**）。

## 3. 消費順（`User#consume_credits!`）
**期限付きグラント（期限が近い順）→ サブスク枠 → Top-up**。
- 期限切れ／残量0グラントは対象外（`active`/`consume_order` で除外・整列）。
- 合算残高 < 要求量なら `User::InsufficientCredits`（**台帳記録なし・残高はマイナスにしない**）。生成は 422 を返し、retry は無料。
- 複数グラントを跨ぐ部分消費に対応（near を使い切ってから far）。

## 4. Free→Paid 引き継ぎ（free_carryover）
- **初回 Paid 化時のみ**。判定：`free_carryover` グラント未付与 かつ paid の `subscription_grant`（`subscription_id` 付き）が無い。
- `carry = min(現Free残高, Free月間枠pt)`（**CAP=Free月間枠**）。`carry<=0` なら作らない。
- `expires_at = next_free_credit_reset_at`（**元のFree枠の期限を継承**＝登録日基準の現周期末）。
- その後サブスク枠は通常どおり `reset_subscription_credits!(plan枠)`。結果＝「ボーナス(期限付き) + プラン枠」。

## 5. サブスク更新・プラン変更
- 毎回の `invoice.paid` で `reset_subscription_credits!` ＝ **当月プラン枠へ上書き**（未使用サブスク枠は繰り越さない）。
- **Top-up は不変**（更新・変更で消えない）。**期限付きグラントは期限内なら維持**。
- プラン変更（標準⇄上位）：Stripe が比例請求 invoice を発行 → invoice.paid → 新プラン枠へリセット（簡潔・寛容寄り）。ダウングレードは Portal 既定 `at_period_end`。

## 6. Stripe Webhook ごとの責務（`WebhookHandler#call`）
| event | 責務 |
|---|---|
| `checkout.session.completed`(payment) | Top-up 加算（subscription mode は何もしない＝subで処理） |
| `customer.subscription.created` | `sync_subscription`（local upsert）＋ trial 中ならクレジット付与 |
| `customer.subscription.updated` | `sync_subscription`（status/期間/プラン更新。クレジットは触らない） |
| `customer.subscription.deleted` | 残サブスク枠を失効しキャンセル化（`status=="canceled"` で早期 return＝冪等） |
| `invoice.paid` | （初回のみ carryover）→ サブスク枠を当月分にリセット付与 |

Stripe API `2025-03+/dahlia` 対応：未知メソッドは NoMethodError になるため **`[]` アクセス**。`subscription.current_period_*`→items 配下、`invoice.subscription`→`invoice.parent.subscription_details.subscription`、明細 price→`line.pricing.price_details.price`（旧/新両対応）。

## 7. 冪等性の考え方
- クレジット付与系は **`credit_transactions.stripe_event_id`（UNIQUE）** で冪等化。`processed?(event)` が同一 event_id の存在で早期 return。
- `subscription.deleted` は `status=="canceled"` で早期 return（再配信でも二重失効しない）。
- 受け口は署名検証失敗で `400`、処理失敗で `422`（Stripe にリトライさせ恒久握り潰しを防ぐ）。署名失敗は warn ログ。

## 8. 正常系フロー（サブスク購入）
1. `/billing` で購入 → Checkout（mode=subscription、`client_reference_id=user.id`、`Billing::Customers.ensure` で `stripe_customer_id` 保存）。
2. 決済 → `customer.subscription.created`（local sub 作成）／`invoice.paid`（初回 carryover＋プラン枠付与）。
3. `/billing?checkout=success` に戻り、サマリーを短時間ポーリング → 残高・内訳・プラン反映。

## 9. 異常系フロー
- Webhook 未到達／署名不一致 → サブスク未作成＝free のまま（ローカルは `stripe listen` ＋ secret 一致＋同一アカウントが必要：[[stripe-billing-progress]]）。
- plan/price 不一致 → `Plan.find_by(stripe_price_id:)` nil で早期 return（付与しない）。
- 残高不足 → `InsufficientCredits` → 生成 422。
- 期限切れグラント → 消費対象外。日次 `ExpireCreditGrantsJob` が `remaining_points=0`＋`grant_expire` 記録。

## 10. 実装済み / 未実装
- **済**：grant 3種別・消費順・Top-up・サブスク lifecycle・内訳API/表示・期限切れ日次ジョブ・キャンペーン rake・dahlia 対応・冪等化。
- **撤去**：Free→Paid carryover（#573。無料枠が期限付きの grant になった時点で不要になった。下記 11.）
- **将来**：プラン別保有上限（MAXカード数）／返金(`refund`)・調整(`adjustment`) の正式フロー／キャッシュHIT半額・品質倍率（`Billing::CreditCost`）／失効予定の通知／使用量グラフ。

## 11. Free→Paid の扱い（#300 → #573・2026-08-12 決着）

**Free→Paid の引き継ぎ（`free_carryover`）は撤去した。** 無料枠は `credit_grants`（`trial` / `monthly_free`）に**期限付き**（`CreditExpiryPolicy`）で積まれ、有料化しても失効しない（`reset_subscription_credits!` が触るのは `subscription_credits` だけ、`forfeit` は解約時のみ）。「使い残しを失効させない」という目的はグラント方式が既に満たしており、改めて引き継ぐと二重に数えることになる。

経緯：carryover は #298 の「無料枠が `subscription_credits` に入り、量は free プランの `credits_per_period` が決める」時代の実装。#439 で無料枠が grant 方式（量は `GrantPolicy` / `Billing::Catalog`）へ移った際に取り残され、本番では CAP が常に 0（free プランの `credits_per_period` は意図的に 0）で1件も作られていなかった。詳細は `docs/decisions/credit-model.md` 末尾の追記。

副次的に、この死んだ判定（`first_paid_grant?`）が抱えていた #300 のレース（`invoice.paid` が `customer.subscription.created` より先着し carry=0 のとき、次の更新で paid 残を誤って引き継ぐ）も、判定ごと無くなって解消した。

先着で local Subscription が見つからないときは `Rails.logger.warn` を残す（付与自体は続行）。回帰は `spec/services/billing/webhook_handler_spec.rb`「Free→Paid の切り替え」と `spec/services/billing/catalog_spec.rb`「free プランの位置づけ」が見張る。
