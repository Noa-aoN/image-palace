# 速度の見かた・直しかた

「遅い」と言われたときに辿る順路と、確認する場所。
実際にどう使ったかの記録は [performance-history.md](./performance-history.md)。

---

## 0. 大原則

### 測ってから直す

**推測で直さない。** 2026-08 の調査では、当初「JS が重い」「画像が重い」と
見当を付けていたが、実測するとどちらも犯人ではなかった。
真犯人は DB までの距離（片道70ms）で、これは測らなければ絶対に分からない。

### 本数を数える。時間だけを見ない

速さは環境で揺れるが、**問い合わせの本数は決定的**。
「1件あたり1本」の形をした N+1 は、件数が増えるまで誰も気づかない。

### 外側から順に切り分ける

フロント → CDN → API → DB の順に、**無料・非破壊で測れるものから**。
どこが犯人でないかを先に確定させると、探す範囲が一気に狭まる。

---

## 1. 調査手順

### 手順1: フロントか否かを切る（数分・無料）

```bash
# 主要ページの TTFB。120ms 前後なら、フロントは犯人ではない
for u in / /items /library /board /achievements; do
  curl -s -o /dev/null -w "$u ttfb=%{time_starttransfer}s\n" "https://imagepalace.app$u"
done
```

JS の総量（brotli 後）:

```bash
tot=0
for u in $(curl -s "https://imagepalace.app/items" | grep -oE '/_next/static/[^"]+\.js' | sort -u); do
  s=$(curl -s -H "Accept-Encoding: br" -o /dev/null -w "%{size_download}" "https://imagepalace.app$u")
  tot=$((tot+s))
done
echo "$((tot/1024))KB"
```

重いライブラリが全ページに載っていないかも見る（three.js は 876KB ある）:

```bash
# そのページのチャンクに含まれるか
curl -s "https://imagepalace.app$PAGE" | grep -oE '/_next/static/[^"]+\.js' | sort -u |
  while read u; do curl -s "https://imagepalace.app$u" | grep -q "WebGLRenderer" && echo "three: $u"; done
```

### 手順2: 静的ファイルと画像（数分・無料）

```bash
# ビルド成果物。immutable でなければそこが問題
curl -s -D - -o /dev/null "https://imagepalace.app/_next/static/chunks/xxx.js" | grep -i cache-control

# CDN の画像。**GET で見る**（HEAD だと常に DYNAMIC が返る）
curl -s -D - -o /dev/null "https://cdn.imagepalace.app/<key>" |
  grep -iE "cf-cache-status|cache-control|content-type|content-length|age"
```

期待する値:
- `/_next/static/*` … `public, max-age=31536000, immutable`
- 画像 … `cf-cache-status: HIT` / `immutable` / `image/webp`
- 2回目のリクエストで `age` が付く（1回目は MISS で正常）

### 手順3: DB までの距離を測る（最重要・数分）

**ここを飛ばさない。** 全ての判断の前提になる。

```ruby
# scratchpad/lat.rb
ActiveRecord::Base.connection.execute("SELECT 1")   # 暖機
t = 20.times.map do
  s = Process.clock_gettime(Process::CLOCK_MONOTONIC)
  ActiveRecord::Base.connection.execute("SELECT 1")
  (Process.clock_gettime(Process::CLOCK_MONOTONIC) - s) * 1000
end
puts "DB往復: 中央値=#{t.sort[10].round(1)}ms 最小=#{t.min.round(1)}ms"
puts "region=#{ENV['FLY_REGION']}"
```

```bash
# worker機で実行する（app機で重い処理を回すと本番APIが落ちる）
B64=$(base64 < scratchpad/lat.rb | tr -d '\n')
fly machine exec <worker-id> -a image-palace-api --timeout 180 \
  "/bin/sh -c \"echo $B64 | base64 -d > /tmp/l.rb && cd /app && bin/rails runner /tmp/l.rb\""
```

**中央値と最小がほぼ同じなら、それは純粋なネットワーク遅延**（DBの負荷ではない）。

> `fly machine exec` は時々 `unexpected EOF` を返す。再実行で通る。

### 手順4: エンドポイントの本数と時間を採る

```ruby
def probe(label)
  n = 0
  sub = ActiveSupport::Notifications.subscribe("sql.active_record") { |*, p| n += 1 unless p[:name].to_s =~ /SCHEMA|TRANSACTION/ }
  t = Process.clock_gettime(Process::CLOCK_MONOTONIC)
  yield
  puts "#{label} #{((Process.clock_gettime(Process::CLOCK_MONOTONIC) - t) * 1000).round}ms #{n}本"
ensure
  ActiveSupport::Notifications.unsubscribe(sub)
end

probe("暖機") { user.items.count }   # 1本目は接続確立を含む。必ず捨てる
probe("カード一覧") { ... }
```

**遅いSQLを特定したいときは、SQL 文と時間の両方を採る:**

```ruby
rows = []
ActiveSupport::Notifications.subscribe("sql.active_record") do |_, s, f, _, p|
  next if p[:name].to_s =~ /SCHEMA|TRANSACTION/
  rows << [ ((f - s) * 1000).round, p[:sql].to_s.gsub(/\s+/, " ")[0, 80] ]
end
# ... 実行 ...
rows.sort_by { |ms, _| -ms }.first(10).each { |ms, s| puts "#{ms}ms #{s}" }
```

**全部が同じ時間（＝往復時間）なら、本数の問題。**
1本だけ突出しているなら、そのSQLの問題。

### 手順5: 本番ログを見る

```bash
fly logs -a image-palace-api --no-tail | grep "ActiveRecord:"
```

`ActiveRecord: 19.8ms (5 queries)` のように**時間と本数が両方出る**。
1本あたりの時間を暗算して、往復時間と比べる。

> 二極化していたら Neon の scale-to-zero（休止明け）を疑う。
> 通常 2.4ms / 本のところ、復帰直後だけ 109ms / 本になる。

---

## 2. 領域ごとの確認ポイント

### フロント

- [ ] Document の TTFB（120ms 前後なら正常）
- [ ] JS の総量（brotli 後）と、ページごとのチャンク数
- [ ] 重いライブラリ（three.js / xyflow）が `dynamic()` で切られているか
- [ ] `"use client"` が本当に要るか（既定は Server Component）
- [ ] 一覧の画像に `loading="lazy"` / `decoding="async"` が付いているか
- [ ] スケルトンが出ているか（体感は「待たされた実感」で決まる）
- [ ] 遷移のたびに同じ API を取り直していないか

### CDN / 画像

- [ ] `cf-cache-status: HIT`（**GET で確認**。HEAD は常に DYNAMIC）
- [ ] `cache-control: immutable`
- [ ] `content-type: image/webp`
- [ ] **一覧が `thumb_url` を使っているか**（元画像へのフォールバックが多くないか）
- [ ] サムネイルの無い Media が溜まっていないか

```ruby
with_file  = ActiveStorage::Attachment.where(record_type: "Media", name: "file").pluck(:record_id)
with_thumb = ActiveStorage::Attachment.where(record_type: "Media", name: "thumb").pluck(:record_id)
puts "サムネ無し=#{(with_file - with_thumb).size}件"
```

### API

- [ ] **eager load の漏れ**。特に `has_one_attached` の**両方**（`file` と `thumb`）
- [ ] **読み込み済みの関連にスコープを当てていないか**（`.ordered` `.recent` など）
- [ ] 一覧が詳細と同じ payload を返していないか
- [ ] 同じ集計を1リクエスト中に何度も走らせていないか
- [ ] 外部API（Wikipedia・OpenAI）が表示の同期経路に入っていないか
- [ ] ページを開いた瞬間に重い評価が同期で走っていないか

### DB

- [ ] **まず距離を測る**（手順3）
- [ ] `ORDER BY` / `WHERE` / `JOIN` に index があるか
- [ ] count 系・集計系が毎回走っていないか（`user_stats` に寄せられないか）
- [ ] `EXPLAIN ANALYZE` は**往復が近い環境でだけ意味がある**。
      70ms の往復の中では、1ms の実行時間差は見えない

### ジョブ（Solid Queue）

- [ ] worker が Web と同居していないか（`SOLID_QUEUE_IN_PUMA` が未設定であること）
- [ ] `SolidQueue::Process` の hostname が**1台だけ**か（2リージョンで動いていないか）
- [ ] 滞留していないか

```ruby
puts "実行中=#{SolidQueue::ClaimedExecution.count} 待ち=#{SolidQueue::ReadyExecution.count}"
puts "worker=#{SolidQueue::Process.pluck(:kind, :hostname).inspect}"
```

---

## 3. よくある落とし穴

### `has_one_attached` は2つ読む

`media.thumb.attached?` は、`thumb_attachment` と `blob` で**2往復**する。
`includes(medias: { file_attachment: :blob })` だけでは足りない。

```ruby
# app/models/item.rb
MEDIA_INCLUDES = { medias: [ { file_attachment: :blob }, { thumb_attachment: :blob } ] }.freeze
```

**一覧を書くときは必ずこれを使う。** `file` だけ読んで安心しない。

### 読み込み済みの関連にスコープを当てると、もう1本飛ぶ

```ruby
item.meanings.ordered      # ✗ includes 済みでも問い合わせが増える
item.sorted_meanings       # ○ メモリ上で並べ替える
```

### 同じ数を数え直す

条件の種類が8つしかないのに、定義の数だけ数えると本数が定義数に比例する。
1リクエスト中はメモ化する。ただし**作ってすぐ読む道筋があるものはメモ化しない**
（足したばかりのデータが見えなくなる）。

### Workers Assets の既定は `max-age=0`

Cloudflare Workers の静的配信は、**何もしないと毎回再検証**になる。
`frontend/public/_headers` で寿命を与える。ハッシュ付きのビルド成果物は `immutable`。

### `CGI.escape` を URL のパスに使わない

空白が `+` になる。パスでは `%20` でなければならない。
`ERB::Util.url_encode` を使う。

### 重い処理は worker 機で

app 機で重い保守処理を回すと本番 API が 503 になる（実績あり）。

---

## 4. 回帰を防ぐ

**速さではなく本数をテストする。** 速さは環境で揺れるが、本数は決定的。

```ruby
# spec/requests/api/v1/items_query_count_spec.rb が型
it "枚数を増やしても問い合わせの本数は増えない" do
  2.times { create_card }
  get "/api/v1/items", headers: headers   # 1回目は捨てる（初期化を含む）

  few = count_queries { get "/api/v1/items", headers: headers }
  6.times { create_card }
  many = count_queries { get "/api/v1/items", headers: headers }

  expect(many).to eq(few)
end
```

**認証まわりは数から外す。** devise-token-auth はトークンを一定の窓でまとめて
更新するので、同じ操作でも `users` への問い合わせが1本増減する（これで一度
不安定なテストを作ってしまった）。

```ruby
next if payload[:sql].to_s.match?(/"(users|settings)"/)
```

**入れる前に、修正を戻すとテストが落ちることを必ず確認する。**
落ちないテストは、無いのと同じ。

既存の見張り:
- `spec/requests/api/v1/items_query_count_spec.rb` … カード一覧
- `spec/services/achievements/evaluator_spec.rb` … 実績の評価
- `spec/requests/api/v1/item_headline_spec.rb` … 項目定義の読み込み回数

---

## 5. 世界展開したときの方針

いまは利用者がほぼ日本にいるので、app を DB の隣（sin）に置くのが最適。
**利用者が世界に散ったら前提が変わる。** そのときの考え方。

### 原則: 読み取りはエッジへ、整合性は1か所に

| どこに置くか | 何を | なぜ |
|---|---|---|
| **Cloudflare（エッジ）** | 読み取り専用・全員に同じもの | 近い・安い・落ちにくい |
| **メインDB（1か所）** | 書き込み・整合性が要るもの | 分散させると壊れる |

### Cloudflare へ逃がしてよい読み取りデータ

- **画像**（実施済み。R2 + CDN）
- **静的ファイル**（実施済み。`immutable`）
- **読みもの（お知らせ・使い方・コラム）** … 全員に同じ内容。更新も稀
- **プランの一覧・価格表** … 変わったときに流し直せばよい
- **公開ページの HTML**（LP・利用規約・プライバシー）… 既に Workers で配信
- **実績・獲得物の定義**（何があるか。誰が持っているかは別）
- **Wikipedia の要約キャッシュ** … 外部データで、誰にとっても同じ

やり方の候補: Workers KV（読み取りが速い・結果整合）、
D1（読み取りレプリカ）、あるいは単に長い `cache-control` を付けた JSON。

### メインDBに残すべきもの（分散させない）

- **クレジット残高と消費**。二重に使われたら金銭事故になる
- **サブスク・決済の状態**（Stripe との突き合わせ）
- **引き換えコードの使用済み判定**。同じコードが二度使われてはいけない
- **画像生成の重複判定**（`shared_media.normalized_prompt` の UNIQUE）。
  ここが割れると同じ単語で二度 OpenAI を叩き、キャッシュ設計が崩れる
- **カードそのもの・項目の値**。利用者が書いたもので、古い値が見えると混乱する
- **実績の達成状態**（誰が何を取ったか）

### 段階的な進め方（発火条件つき）

1. **いまは何もしない。** 日本以外の利用者が有意に増えるまで
2. 増えたら**まず読み取りをエッジへ**。上の「逃がしてよい」から順に
3. それでも遅ければ **Neon の read replica を近い地域に置く**
   （書き込みは1か所のまま）。費用が発生するので試算してから
4. 最後の手段として**マルチリージョン**。整合性の設計が要るので、
   ここに来る前に必ず設計を書く

**「スケール耐性 lean」の方針どおり、発火条件を決めて後追いする。**
先回りして作らない。

---

## 6. 運用ルール

### 追加コストがある施策は、必ず金額感を出してから

**実行前に月額の影響を提示し、確認を取る。** 例外なし。

過去に検討した施策の金額感（2026-08 時点）:

| 施策 | 月額影響 |
|---|---|
| app を sin へ移す | **±0**（同じマシン単価） |
| 移設中の一時的な重複稼働 | 約 $0.01（10分程度） |
| Fly Managed Postgres `nrt` | +$38〜 |
| Supabase Tokyo（Pro + Micro） | +$25 |
| AWS RDS `ap-northeast-1`（t4g.micro） | +$20前後〜 |
| Aurora Serverless v2 Tokyo（0.5ACU常時） | +$45前後〜 |
| Neon の scale-to-zero を切る | 要試算（コンピュート稼働時間が増える） |

**「たぶん安い」で進めない。** 一時的なマシン1台でも、実行前に伝える。

### 削除は確認してから

blob・画像・DBレコードの削除は、**必ず対象一覧を出して確認を取る**。
dry-run できるものは dry-run → 実行の順に。

将来 blob 掃除を書く場合、少なくとも以下を除外する:
- `plans.image_key` 参照
- `reward_definitions.image_key` 参照
- 失敗・復旧対象の生成カードに紐づく blob
- その他 ActiveStorage 添付以外の参照カラム

### 構成変更は、原因が明確になってから

Redis・Sidekiq・DB 移行のような構成変更は、**実測で原因を特定してから**提案する。
「一般に速くなる」は理由にならない。今回、Redis を入れていたら
往復が1つ増えるだけで、何も解決しなかった。

### 一次情報を確認する

リージョンの有無・料金・API の仕様は、**公式を見てから書く**。
「Neon に東京がある」と記憶で書いて、実際には無かった。
