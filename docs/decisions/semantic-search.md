# 意味検索（semantic search）アーキテクチャ決定 — pgvector + OpenAI

> ステータス: **設計確定 / 実装は保留（deferred）** — 2026-06-30 記録
> 関連: 検索画面の「意味が近いカードも探す」オプション（通常検索は維持）

## 背景・目的
正確な単語を思い出せない時に、**自分のカードを“意味”で探せる**ようにする（サービスの核「想起支援」）。
通常検索（`GET /api/v1/search` の ILIKE）は維持し、**オプションとして意味検索を追加**する。

## 検討した構成
- **A. pgvector(Neon) + OpenAI `text-embedding-3-small`(1536)**（neighbor gem）
- **B. Cloudflare Workers AI `bge-m3`(1024) + Vectorize**
- **C. ハイブリッド: bge-m3(REST) で埋め込み + pgvector に保存**

## コスト（5万カード規模・2026 料金で試算）
| 項目 | A | B |
|---|---|---|
| 埋め込み生成(初回5M tok) | OpenAI $0.02/1M → 約$0.10 | bge-m3 $0.012/1M → 約$0.06（10k neuron/日 無料枠） |
| ベクトル保存 | Neon $0.35/GB月：約$0.1/月（dim=512で約$0.035） | Vectorize $0.05/100M dims：約$0.03/月（無料枠10M） |
| クエリ課金 | なし（DB内） | $0.01/1M queried dims（無料枠潤沢）→ほぼ$0 |
| 新規インフラ | 不要 | Vectorize index＋同期パイプライン |

→ **どの案も月 <$0.5。コストは決め手にならない。**

## 決定：構成A（pgvector + OpenAI）
理由は「最安」ではなく、本アプリの条件への適合：
1. **意味検索は per-user（自分のカードのみ）** ＝数十〜数百件。pgvector の `WHERE user_id=?` 総当たりで即時（ANNインデックス不要）。Vectorize の巨大ANNは不要。
2. **単一データストア**：ベクトルが items と同一DB＝作成/更新/**削除がFKで自動整合**。Bは別ストアの同期パイプラインが新たな故障点。
3. **検索は既に Rails 所有**：新ネットワークホップ0、`current_user` スコープ流用。Bは検索のWorker移設 or クロスクラウドREST。
4. **OpenAI は導入済み**（画像生成）＝追加外部依存が最小。
5. 品質：OpenAI 3-small / bge-m3 とも多言語(日本語)良好。

### プロバイダ抽象化
既存の `IMAGE_GENERATION_PROVIDER` Strategy を踏襲し **`EMBEDDING_PROVIDER` を抽象化**。
→ **保存先＝pgvector を確定**、**埋め込みプロバイダは後で bge-m3 等へ無改修で交換可能**（日本語精度が弱ければ切替）。

### B（Vectorize/Workers AI）に切り替える発火条件
検索をエッジ(Worker)へ移設／横断・公開カードで数百万ベクトル規模／OpenAI依存を完全排除したい場合。今は非該当。

## MVP スコープ（実装時）
**やる**: 検索画面トグル（既定OFF・通常検索不変）。items のみ・`current_user` スコープ。`item_embeddings` 別テーブル（item_id, embedding vector, source_hash, model）。合成文＝title＋ja meaning(definition/example)＋tags を埋め込み。作成/更新時に非同期 EmbedItemJob（source_hash で冪等）＋backfill rake。コサイン近傍 top20＋しきい値、通常一致と重複排除。
**やらない**: decks/collections/spaces の semantic、画像(CLIP)類似、Vectorize/エッジ、ハイブリッド検索/リランキング、横断・公開。

## 実装の前提インフラ（保留中の要対応）
- **pgvector を local/CI の Postgres でも有効化**：`docker-compose.yml` と `.github/workflows/ci.yml` の `postgres:16-alpine` を **pgvector同梱イメージ**（例 `pgvector/pgvector:pg16`）へ。本番 Neon は pgvector 標準対応。
- `neighbor` gem 追加、`enable_extension "vector"` migration。
- 既定 `dimensions=512`（OpenAI）でベクトルを軽量化する案を検討。

## 補足
- `pg_trgm`(タイポ許容) は通常検索の別軸の小改善（意味検索の代替ではない）。
- 出典: Vectorize/Workers AI/Neon の各 Pricing、bge-m3 モデルページ、Rails neighbor gem。

## 現状
設計はこのドキュメントで確定。**実装は保留**（タスク Tier3-1〜5）。再開時は本書の MVP スコープと前提インフラから着手する。
