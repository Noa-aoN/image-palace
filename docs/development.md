# 開発フロー

## 起動フロー

1. **ターミナル①（サーバー）**
   ```bash
   make up
   ```

2. **ターミナル②（作業）**
   ```bash
   make shell
   ```

3. **動作確認**
   ```bash
   curl localhost:3001
   ```

---

## 終了フロー

### 通常終了
```bash
make down
```

### 再起動
```bash
make restart
```

### 完全リセット（不具合時）
```bash
make reset
```

---

## 運用ルール

- `docker compose up` は専用ターミナルで常時起動
- 作業は別ターミナルで `docker compose exec` を使用
- 不要な `docker compose build` は実行しない
- 異常時は `down` → `restart` → `reset` の順で対応する

---

## DBセットアップ方針

- 通常は `db:create` は不要（docker-composeにより自動作成される）
- 状態確認は `rails db:migrate:status` を使用する
- 必要な場合のみ `rails db:migrate` を実行する

---

## Makefile コマンド一覧

| コマンド | 説明 |
|---------|------|
| `make up` | サーバー起動 |
| `make down` | サーバー停止 |
| `make restart` | サーバー再起動 |
| `make reset` | 完全リセット（ボリューム削除＋再ビルド） |
| `make logs` | ログを追従表示 |
| `make shell` | コンテナ内シェルに接続 |
| `make migrate` | DBマイグレーション実行 |
| `make console` | Rails console起動 |
