# ADR: 本番マイグレーションのアドバイザリロック無効化

- **日付**: 2026-06-13
- **ステータス**: 承認済み
- **決定者**: チーム

---

## コンテキスト

#84（`settings.auto_generate_meanings` カラム追加）を本番へデプロイした際、
Fly の `release_command`（`bundle exec rails db:migrate db:seed`）が次のエラーで失敗した。

```
ActiveRecord::ConcurrentMigrationError: Failed to release advisory lock
（再実行時）Cannot run migrations because another migration process is currently running.
```

- マイグレーション自体は適用されていた（`AddAutoGenerateMeaningsToSettings: migrated`）。
- 原因は **Neon（プール接続）と Rails マイグレーションのアドバイザリロックの相性問題**。
  Neon のプーラはセッションを維持するため、マイグレーション中に接続が差し替わると
  Rails が取得したセッションスコープのアドバイザリロックを解放できず、ロックが残留する。
  以降の `db:migrate` は「別のマイグレーションが実行中」と判定してデッドロックする。
- 過去のデプロイが成功していたのは、pending マイグレーションが無く migrate が no-op で、
  ロック保持時間が極めて短かったため。実マイグレーションが走って初めて顕在化した。

---

## 決定

`config/database.yml` の production 接続で **`advisory_locks: false`** を設定する。

```yaml
production:
  adapter: postgresql
  ...
  advisory_locks: false
  url: <%= ENV["DATABASE_URL"] %>
```

---

## 根拠

アドバイザリロックの目的は「複数のマイグレーションプロセスの同時実行を防ぐ」こと。
本プロジェクトの構成ではこの同時実行が構造的に起こらない。

- `fly.toml` の `release_command` は Fly が**単一マシンでリリース毎に1回だけ**実行する。
- `min_machines_running = 1` / `auto_start_machines = false` で複数インスタンスの同時実行も無い。
- CI はマイグレーションではなく `db:schema:load` を使う。
- Solid Queue は同一DBだが行ロック（`FOR UPDATE SKIP LOCKED`）で advisory lock は使わない。

よって、失われる保護（同時マイグレーション防止）は不要であり、無効化は安全。

---

## 検討した代替案

- **Neon の直結（unpooled）エンドポイントでマイグレーションを実行**：
  advisory lock を維持できるが、migration 用の別 URL secret と設定が必要で複雑。
  現構成では割に合わないため見送り。
- **残留ロックの手動解放／Neon コンピュート再起動**：その場しのぎで、次回マイグレーションで再発するため不採用。

---

## 影響・再検討のトリガー

- 将来 `release_command` を複数マシンで並列実行する、あるいは手動マイグレーションを
  デプロイと並行運用する運用に変えた場合は、本決定（advisory_locks 無効化）を再検討する。
- 恒久的なコード上の記録は `config/database.yml` のコメントが担う。
