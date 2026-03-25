# トラブルシューティング

## Dockerハング時の対処

Docker Desktopが起動しているように見えるが、内部のDocker Engine（Linux VM）がフリーズしている状態への対処法。

### 症状

- `docker.sock` への接続で `context deadline exceeded`
- `docker builder prune` / `buildx create` が失敗
- `docker compose` 系コマンドがすべて無反応

### 対処手順

1. **Dockerプロセスの完全停止**
   ```bash
   sudo pkill -f Docker
   sudo kill -9 <DockerプロセスID>  # 必要に応じて
   ```

2. **socketファイルの削除**
   ```bash
   rm -rf ~/.docker/run
   ```

3. **Docker内部データの削除（完全リセット）**
   - Finderで `~/Library/Containers/com.docker.docker` を削除（推奨）
   - またはコマンドで削除

4. **Docker Desktopの再起動**
   ```bash
   open -a Docker
   ```
   1〜2分待ってDocker Desktopが完全に起動するのを待つ

5. **動作確認**
   ```bash
   docker run hello-world
   ```

正常に動作していれば、以下が出力されます：
```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

---

## Rails起動エラー（server.pid）

### 症状

```
A server is already running. Check /app/tmp/pids/server.pid
```

### 原因

異常終了による `server.pid` ファイルの残存

### 対策

**起動時自動削除により防止済み**

`docker-compose.yml` の `web` サービスに以下を追加しています：
```yaml
command: bash -c "rm -f tmp/pids/server.pid && bundle exec rails s -b 0.0.0.0 -p 3001"
```

これにより、起動時に自動的に `server.pid` が削除されるため、問題は発生しません。

---

## ポート競合

### 症状

```
Error: bind: address already in use
```

### 対処法

使用中のプロセスを確認して停止する：
```bash
lsof -i :3001  # ポート3001を使用しているプロセスを確認
kill -9 <PID>  # プロセスを強制終了
```

---

## コンテナ起動失敗

### 対処法

1. **ログを確認**
   ```bash
   make logs
   ```

2. **ボリュームを削除して再起動**
   ```bash
   make reset
   ```

3. **イメージを再ビルド**
   ```bash
   docker compose build --no-cache
   docker compose up
   ```

---

## DB接続エラー

### 対処法

1. **DBコンテナの状態を確認**
   ```bash
   docker compose ps
   ```

2. **DBヘルスチェックを待機**
   - `docker-compose.yml` に `healthcheck` が設定されているため、通常30秒程度で自動的に接続可能になります

3. **マイグレーション状態を確認**
   ```bash
   make migrate
   ```
