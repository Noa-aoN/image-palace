# クレジットモデル拡張：期限付きグラント＋Free→Paid 引き継ぎ

> ステータス: **v1 実装・本番反映済み（2026-06-30）／ v2 未着手** — 設計記録
> 関連: [[stripe-billing-progress]]、`app/models/user.rb`、`app/services/billing/webhook_handler.rb`

## 背景・目的
Free→Paid 切替時、現状は Free 残高が**失効（reset で上書き）**される。ユーザーが「Free残高＋新プラン枠」にならず損に感じうる。
一方、無制限の加算・繰り越しは**画像生成コストの負債**になるため避けたい。
→ **「期限あり/なしのクレジット種別」**を導入し、Free 残高は**上限付き・期限付き**で引き継ぐ。将来のキャンペーン発行にも使える設計にする。

## クレジット3種別（概念）
| 種別 | 期限 | 繰り越し | 例 |
|---|---|---|---|
| **グラント（bonus/grant）** | あり（expires_at） | 上限付きで保持 | Free引き継ぎ、キャンペーン、お詫び付与 |
| **サブスク** | 実質月次（reset） | 毎周期上書き | 月間プラン枠 |
| **Top-up** | なし | 恒久加算 | 買い切りチャージ |

## データモデル（推奨：`credit_grants` テーブル）
ユーザーに `bonus_credits` 列を足すだけ（単一バケット）でも最小実装は可能だが、**複数の期限・キャンペーン併存**を考えるとテーブル化が将来安全：
```
credit_grants
  id, user_id,
  kind: string        # free_carryover / campaign / goodwill ...
  amount_points: int  # 付与時の総量
  remaining_points: int
  expires_at: datetime (nullable=期限なしも表現可)
  metadata: jsonb     # campaign_id 等
  created_at, updated_at
  index [user_id, expires_at]
```
- **有効グラント** = `remaining_points > 0 AND (expires_at IS NULL OR expires_at > now)`
- `available_credit_points` = Σ(有効グラント remaining) + subscription_credits + topup_credits
- 期限切れは**遅延評価**（読み取り/消費時に除外）＋任意で日次ジョブで `expired` を ledger 記録（表示・会計の正確性）。

## Free→Paid 引き継ぎルール
- **初回 Paid 切替時のみ**：`carry = min(現在のFree残高, CAP)`
  - CAP 案：**最大10枚相当** もしくは **Free月間枠1ヶ月分（N_free）** のいずれか小さい方（要決定）。
- `credit_grants` に `kind: free_carryover, amount: carry, expires_at: Paid開始 + 30日` を作成。
- その後、サブスク枠は通常どおり付与（既存 reset を維持）。
- 「初回のみ」判定：当該イベント前に**有効な有料サブスクが無かった**こと＋ Free 残高を**reset 前にキャプチャ**。`stripe_event_id` で冪等化。

## 消費順
**期限付きグラント（expires_at 近い順）→ サブスク → Top-up**
（最も早く失効するものから消費＝失効ロスを最小化。Top-up は恒久なので最後。）

## 影響箇所
- `app/models/user.rb`：`available_credit_points` 集計に有効グラントを加算／`consume_credits!` の引き当て順を grant→subscription→topup に／`grant_credits!(amount, kind:, expires_at:)` 追加。
- `app/services/billing/webhook_handler.rb`：初回 Paid 付与時に Free 残高を carryover グラント化（reset 前にキャプチャ）。
- `app/models/credit_transaction.rb`：kind 拡張（`grant_carryover` / `grant_expire` 等）、grant 参照。
- フロント：`available_credits` は合算なので**表示はそのままで反映**。将来「内訳（ボーナス◯枚・期限◯日）」表示は v2。

## 段階導入
- **v1（最小・推奨）**：`credit_grants` テーブル＋集計/消費順の対応＋Free→Paid carryover フック＋テスト。表示は既存の合算残高のまま。
  - さらに小さくするなら users に `bonus_credits`/`bonus_expires_at` 2列案もあるが、キャンペーン併存で作り直しになるため非推奨。
- **v2**：内訳表示（ボーナス/期限）、期限切れ日次ジョブ＋通知、キャンペーン発行（管理/コード）。

## エッジケース
- Paid→Free ダウングレード：Free は従来どおり `ensure_current_period_credits!` で月次。carryover は Free→Paid のみ。
- 再アップグレード：その時点で Free 残高があれば再度 carryover（上限・期限は都度）。
- 二重付与防止：carryover グラントはイベントIDで一意化。reset との順序（capture→grant→reset）を厳守。

## 決定済みパラメータ（2026-06-30・実装反映済み）
1. **CAP = Free 月間枠1ヶ月分**（固定枚数ではなく）。
2. **有効期限 = 元の Free 枠の期限を継承**（＝登録日基準の現周期末 `next_free_credit_reset_at`。Paid開始+30日ではない）。理由：Free枠が登録日基準の期限付きであり、その残高を元期限まで使えるのが一貫して説明しやすい。
3. **v1 は `credit_grants` テーブルで実装**（本番反映済み）。v2（内訳表示・期限切れ日次ジョブ・キャンペーン rake）も反映済み。

## 既知のレース（GitHub Issue 化・本番化前に対応）
`invoice.paid` が `customer.subscription.created` より先着し、かつ初回 carry=0 の場合、初回Paid判定（`subscription_id` 付き subscription_grant の有無）がズレ、更新時に paid 残を誤って carryover し得る。本番は Stripe 休眠で実害ゼロ。堅牢化案＝subscription スコープ判定 or `users` に初回Paidフラグ。

## 関連ドキュメント
- 仕様・フロー：`docs/billing-credit-flow.md`
- テスト計画：`docs/testing/billing-credit-test-plan.md`
- 進捗・運用メモ：[[stripe-billing-progress]]

---

## 追記（2026-08-12）: Free→Paid 引き継ぎ（free_carryover）を撤去した

> ステータス: 採用 / 関連 Issue: #573・#300（PR #571）

### 何を変えたか

`Billing::PaymentApplier` から `first_paid_grant?` と `carry_over_free_balance!` を
**削除した**。Free→Paid の初回切替で `free_carryover` グラントを作る処理は無くなった。
`credit_grants.kind` と表示ラベルの `free_carryover` は、過去に作られた行のために残す。

### なぜ

この文書の本文（2026-06-30 / #298）を書いた時点では、**無料枠は `subscription_credits` に入り、
その量は `plans` の free 行（`credits_per_period`）が決めていた**。だから
「Free 残高を CAP=Free 月間枠で引き継ぐ」は正しく動いていた。

その後 #439「無料枠を絞り、同じ相手への配り直しを塞ぐ」で無料枠の作りが変わった。

| | 以前（#298 当時） | いま |
|---|---|---|
| 無料枠の入れ物 | `subscription_credits` | `credit_grants`（kind: `trial` / `monthly_free`） |
| 量の出どころ | `plans` の free 行 | `GrantPolicy`（行が無ければ `Billing::Catalog`：お試し3cr・毎月1cr） |
| 期限 | 月次で失効 | 受け取りから6ヶ月（`CREDIT_LIFETIME`） |
| free プランの `credits_per_period` | 無料枠の量 | **0**（`Catalog` に「free は契約なしを表す枠。毎月の付与は行わない」と明記） |

carryover だけが古い前提のまま残り、CAP は常に 0、引き継ぎ元（`subscription_credits`）も
無料ユーザーでは常に 0 になっていた。**本番の `free_carryover` は0件**（2026-08-12 確認）。

さらに重要なのは、**引き継ぎがもう要らない**こと。無料枠は6ヶ月期限のグラントとして積まれ、
有料化しても失効しない（`reset_subscription_credits!` が触るのは `subscription_credits` だけ、
`forfeit` は解約時のみ）。「使い残しを失効させない」という当初の目的は、グラント方式が
そのまま満たしている。ここで改めて引き継ぐと、生き残っているグラントを二重に数える。

### 副作用として塞いだもの

死んだ判定（`first_paid_grant?`）が #300 のレースを生んでいた。判定そのものが無くなったので、
「初回の有料化」を推定する必要も消えた。

### 現在の責務

| kind | 誰が作るか | 入れ物 | 期限 |
|---|---|---|---|
| `trial` | 登録時1回（`Catalog::TRIAL_CREDITS`／`GrantPolicy` で上書き可） | `credit_grants` | 6ヶ月 |
| `monthly_free` | 訪れた月ごと（有料契約中は配らない） | `credit_grants` | 6ヶ月 |
| `subscription_grant`（台帳） | 有料 invoice・trial 開始 | `subscription_credits` | 次回リセットまで |
| `subscription_carryover` | 当月分の使い残しの移し替え | `credit_grants` | 6ヶ月 − 1ヶ月 |
| `topup` | 買い切り | `credit_grants` | 6ヶ月 |
| `free_carryover` | **もう作らない**（過去行の表示用に kind だけ残す） | — | — |

### 見逃した理由と、置いた見張り

spec の `factory :plan` は free に `credits_per_period = 10` を入れる。本番は 0 なので、
**テストでは通り、本番では常に CAP=0** という食い違いが表に出なかった。
`spec/services/billing/catalog_spec.rb` に「free は price=0 / credits=0」「無料枠は Catalog の
定数から配る」「free プランの `credits_per_period` を無料枠の量として参照している実装が無い」の
3点を固定した。

---

## 2026-08-13 クレジットの寿命を6ヶ月から3ヶ月へ

正式公開初期の期間として、すべてのクレジットの有効期限を**受け取りから3ヶ月**にした。
無料・有料で分けないのは従来どおり。

### なぜ

正式公開の初期は、AI API の値段・採用モデル・為替・1クレジットあたりの実原価・
消化ペース・粗利率のどれもが動く。6ヶ月ぶんの未提供残高を抱えたまま原価が動くと、
売った時の値段と提供する時の原価が離れすぎる。四半期ごとに見直せる長さから始める。

3ヶ月を恒久固定する意図ではない。四半期ごとに、粗利率・実原価・為替・消化率・失効率・
平均消化日数・MRR・Churn・利用者の反応を見て、見通しが立つなら4〜6ヶ月へ延ばす。

**短くするより延ばすほうが説明しやすい**という順序を優先した。
延ばすのは「増えた」と受け取られるが、縮めるのは既に配ったものを取り上げる話になる。

### 6ヶ月を超えないという上限は変えていない

前払式支払手段の適用除外（発行から6ヶ月以内）に収める、という制約はそのまま。
3ヶ月はその内側なので、より安全側へ寄った。

### 決めた場所

`Billing::CreditExpiryPolicy` ひとつ。以前は `Billing::Catalog::CREDIT_LIFETIME` を
各所が参照し、画面と規約には「6ヶ月」が別々に書かれていた。長さを変えるときに
実装・規約・画面・本番データがずれるので、1か所に寄せた。
画面に出す「◯か月」もフロント側の1か所（`CREDIT_VALIDITY_MONTHS`）に集約した。

### 積み残し

1,000枚パックを3ヶ月で使い切るには1日およそ11枚のペースが要る。
「まとめると安い」が見せかけにならないよう、パックの規模を見直すかどうかは別の判断
（値段に触るため）。

既存の本番グラントは**触っていない**。遡及して期限を縮めるのは、
既に配ったものを取り上げる不可逆な変更なので、判断を仰いでから行う。
