# 意思決定ログ: 画像アップロードのセキュリティ方針（libvips 多層防御）

> 作成日: 2026-07-30

---

## 背景・課題

Rails の Active Storage + libvips 構成に、未認証でも到達しうる任意コード実行の脆弱性
（CVE-2026-66066 / 通称 KindaRails2Shell）が公表された。本アプリは成立条件を全て満たしていた。

- Active Storage 有効＋ユーザーが画像をアップロードできる（ボックス/ビュー/スペースのカバー画像、ボード背景）
- 本番 Docker に `libvips42`、`config.active_storage.variant_processor = :vips`
- Rails 8.1.2.1（脆弱範囲 8.1.0〜8.1.3）

さらに悪い点として、`OptimizeImageService` は Active Storage を経由せず、アップロードされた
生バイト列を `Vips::Image.new_from_buffer(data, "")` に直接渡していた。第2引数が空＝ローダを
マジックバイトから自動選択するため、**Rails のバージョンを上げるだけではこの経路は塞がらない**。

---

## 決定

以下の多層防御を採用する。どれか1つが破られても単独では侵害に至らないことを意図している。

### 1. Rails を修正版に追従する

8.1.3.1 へ更新。以後も Rails のセキュリティリリースは最優先で追従する。

### 2. libvips の「信頼できないローダ」を無効化する

SVG（librsvg）や PDF（poppler）のように外部ライブラリへ委譲するローダを止める。

- `VIPS_BLOCK_UNTRUSTED=1` を `fly.toml` の `[env]` と `docker-compose.yml` に設定
- `config/initializers/vips.rb` で `Vips.block_untrusted(true)` を明示呼び出し

環境変数の設定漏れとローカル実行の両方を拾うため、**あえて二重に掛ける**。
libvips 未インストール環境でも起動を妨げないよう、初期化失敗は警告に留める。

### 3. libvips に渡す形式をマジックバイトで allowlist する

`ImageFormat`（`app/services/image_format.rb`）で PNG / JPEG / WebP のみを通す。
**Content-Type は自己申告なので信用しない**。allowlist 外は libvips に触れさせない。

### 4. 出力が本当に WebP かを検証してから保存する

従来は `extension` だけを見ていたため、`Content-Type: image/webp` と詐称した非画像が
変換失敗時のフォールバックで元データのまま保存され得た。出力の実バイト列を検証する。

### 5. アップロード経路にレート制限を掛ける

1件最大 10MB を libvips でデコードするため、転送量と CPU の両方が高コスト。
Rack::Attack で 20回/60秒/IP に制限する（全体上限 300req/5分 だけでは不十分）。

---

## 対応しなかった選択肢

### WAF ルールによる遮断

公表元も「設定依存であり代替にならない」としている。アップロードは正常な機能であり、
ペイロードの見分けを WAF に委ねると誤検知と見逃しの両方を招く。

### libvips をやめて ImageMagick に戻す

ImageMagick は歴史的に同種の脆弱性がより多く、デコード性能も劣る。
本番イメージは libvips のみを同梱する方針を維持する。

### アップロード機能自体の停止

カバー画像はユーザー体験の中核。多層防御で継続可能と判断した。

---

## 運用上の取り決め

- **GIF を解禁する場合**は `ImageFormat::ALLOWED` に `:gif` を追加するだけでよい。
  libvips の gifload は内蔵 libnsgif で外部委譲が無く、`block_untrusted` 下でも動作する
  （8.16.1 で確認済み）。ただしアニメ GIF は 1 コマ目のみ WebP 化される
- **SVG は今後も許可しない**。ベクタ表示が必要になった場合は、libvips に読ませず
  フロントエンドでサニタイズして描画する方式を別途検討する
- 画像生成プロバイダの追加時は、その出力形式が `ImageFormat::ALLOWED` に含まれるか確認する
  （現状 OpenAI=PNG、FLUX=JPEG/PNG）

---

## 検証方法

`block_untrusted` が実際に効いていることは、本番マシン内で以下を確認した。

```
libvips=8.16.1 allowlist_allows_svg=false
OK: SVG rejected by libvips (Vips::Error)
ext=webp type=image/webp bytes=926 thumb=true lqip=true   # 正常系は無傷
```

無効化した状態では同じ SVG が読めるため、この差分が対策の効果そのものである。

---

## 追記: block_untrusted のカバー範囲の実測（2026-08-08）

CI を本番相当イメージで回す検討にあたり、本番イメージ（`ruby:3.3-slim` + `libvips42` 8.16.1）で
各ローダの実挙動を測ったところ、**上記「2. libvips の信頼できないローダを無効化する」が
PDF を止めていなかった**。当初の記述「SVG（librsvg）や PDF（poppler）のように外部ライブラリへ
委譲するローダを止める」は PDF については誤りだった。

`Vips.block_untrusted(true)` 適用後の実測:

| ローダ | 結果 |
|--------|------|
| svgload | ブロック済み |
| magickload | ブロック済み |
| jxlload | ブロック済み |
| pdfload | **到達**（poppler がパースを開始） |
| heifload | **到達 → プロセスが abort**（libheif の assertion 失敗） |
| tiffload | 到達（libtiff） |
| gifload | 到達（内蔵 libnsgif） |

PDF・HEIF・TIFF を実際に止めていたのは `ImageFormat` の allowlist（層3）単独であり、
多層防御の想定より薄かった。特に heifload は壊れた入力でワーカープロセスごと落ちる。

### 追加の決定

**1. 使わない libvips ローダモジュールをイメージから削除する（Dockerfile）**

libvips 8.16 では heif / jxl / magick / openslide / poppler が動的モジュール
（`/usr/lib/*/vips-modules-8.16/*.so`）として遅延ロードされる。遅延ロードのため
`vips_operation_block_set` の事前指定が届かない。ブロックではなく削除して攻撃面を無くす。
apt install と同一レイヤで削除する（後段レイヤでは `.so` がイメージ内に残るため）。

**2. ローダの allowlist を initializer に追加する**

`VipsForeignLoad` 全体をブロックし、`VipsForeignLoadPng` / `Jpeg` / `Webp` の3つだけ解除する。
`ImageFormat::ALLOWED` と同じ集合を libvips 側にも張り、内蔵の svg / tiff / gif も塞ぐ。
ruby-vips 2.3 には `operation_block_set` の Ruby API が無いため、C 関数を FFI で束縛している。
保存側（`VipsForeignSave*`）は対象外なので WebP 変換には影響しない。

**3. 回帰検知を CI に載せる**

`spec/security/vips_hardening_spec.rb` で「モジュールが未登録であること」「残ったローダが
*blocked* を理由に拒否されること」「PNG/JPEG/WebP は通ること」を固定する。
拒否の**理由**まで見るのは、ローダ不在による "not in a known format" と区別するため
（区別しないと、防御が外れた環境でもテストが通ってしまう）。

あわせて `REQUIRE_VIPS=1` のとき `vips_available?` がスキップせず失敗するようにした。
従来 CI ランナーには libvips が無く、画像系 spec は 30 例すべてが黙ってスキップされていた。

### 運用上の取り決めの更新

- **GIF を解禁する場合**、`ImageFormat::ALLOWED` に `:gif` を追加するだけでは**不十分になった**。
  initializer の allowlist で `VipsForeignLoadGif` を解除する必要がある（上記2により）
- HEIC/HEIF は解禁しない。解禁するにはモジュール削除の取りやめが必要で、
  壊れた入力でプロセスが abort する問題を抱え込むことになる
