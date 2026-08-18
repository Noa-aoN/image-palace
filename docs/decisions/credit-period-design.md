# ADR: クレジット周期・更新日の設計

> 追記日: 2026-06-28 / ステータス: 採用

## 背景

「プランの更新日（クレジット付与日）のロジックは整合的で安全か」というレビューを受けて、無料/有料のクレジット周期モデルと、課金ローンチ前に塞ぐべき穴を整理する。

## 決定

### 1. 周期モデルを「登録日アニバーサリー基準（月次）」に統一する

- **無料**: 登録日アニバーサリー基準。`User#free_period_start`（`created_at` から経過月数を足し、当月分が未来なら1ヶ月戻す。月末日は ActiveSupport が丸める）。`ensure_current_period_credits!` が現周期分を lazy 付与し、`credits_period_start` に現周期開始を記録。次回＝`next_free_credit_reset_at`（現周期＋1ヶ月）。
- **有料**: Stripe の契約日アニバーサリー基準。`subscription.current_period_end`（Stripe 同期）。`invoice.paid` webhook で `reset_subscription_credits!`（旧失効＋新付与）。
- ダッシュボード表示（`next_credit_reset`）: 有料=`current_period_end`、無料=`current_user.next_free_credit_reset_at`。**無料・有料とも「登録/契約から1ヶ月ごと」で意味が揃う**。

**理由**: 当初はカレンダー月（無料）／契約日（有料）の非対称だったが、更新日の意味を揃えるため無料も登録日基準に統一した。移行時、既存無料ユーザーは初回参照時に一度だけ現周期分が付与され直す（最大で無料枠1回ぶんの再付与・許容）。

### 2. クレジット台帳は2バケット制（subscription=月次失効／topup=繰り越し）

- 消費は subscription → topup の順（`User#consume_credits!`）。
- 付与/失効は `credit_transactions`（append-only、`stripe_event_id` unique で冪等）。

### 3. 解約確定時にサブスク残クレジットを失効する（今回修正・HIGH）

- `customer.subscription.deleted` で `reset_subscription_credits!(0)` により残分を失効（`subscription_expire` 記録）。冪等性は `status=="canceled"` の早期 return で担保。
- 0デルタの `subscription_grant` ログは残さない（`amount.positive?` ガード）。

### 4. trial（trialing）は有効な有料契約として扱い、trial 開始時に付与する（今回実装）

- `User#active_subscription` のスコープを `%w[active trialing]` に拡張。trial 中ユーザーに無料枠を二重付与しない。
- `customer.subscription.created` が `trialing` の場合、`grant_trial_credits` でプラン分のクレジットを付与（`stripe_event_id` で冪等）。trial 中も生成できる。
- 注: Stripe が trial 中に $0 `invoice.paid` も送る構成でも、`reset_subscription_credits!` は同額・冪等のため残高は二重にならない（台帳に失効/付与ペアが1組増えるのみ）。

### 5. 年プランは「月次付与の定期ジョブ」を実装するまで禁止する（今回実装）

- `invoice.paid` は周期に1回のため、年プランだと年1回しか付与されない（月次商品として不適）。
- `Plan` に **`interval=="year"` のサブスクプランを弾くバリデーション**を追加（`no_annual_subscription_until_supported`）。年プラン導入時は Solid Queue の定期ジョブで月次付与を実装し、本バリデーションを外す。

## 既知の残課題（ローンチ前 TODO）

- 年プランの月次付与ジョブ（実装したらバリデーション解除）。
- Stripe webhook エンドポイント登録・`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` 本番投入。
- Lazy 無料付与は残高表示/生成/スペース生成で発火するため許容（per-request 書込みは避ける）。

## 関連

- 実装: `backend/app/models/user.rb`, `backend/app/services/billing/webhook_handler.rb`
- テスト: `backend/spec/models/credit_ledger_spec.rb`, `backend/spec/services/billing/webhook_handler_spec.rb`
- 表示: PR #278（`next_credit_reset` を無料会員にも表示）
