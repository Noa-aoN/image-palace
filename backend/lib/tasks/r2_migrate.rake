# frozen_string_literal: true

# R2 のバケット引っ越し。
#
# 本番バケットが image-palace-staging という紛らわしい名前のままなので、
# 誤削除を避けるために image-palace-production へ移す。
#
# 設計:
#   - 認証情報は既存の R2 のものをそのまま使い、**バケット名だけ差し替える**。
#     新しい鍵を作らないので、鍵の受け渡しで漏らす経路が増えない。
#   - **存在確認は一覧で行う**。1件ずつ問い合わせると 500件で1000回の API 呼び出しになり、
#     数分かかって実行が時間上限で切れる。一覧なら数回で済む。
#   - **何度でも実行できる**。コピー済みは飛ばすので、途中で切れても続きから埋まる。
#     切り替え直前にもう一度流して、作業中に増えたぶんを拾うのが正しい使い方。
#   - **1回の件数を区切れる**。長時間の実行は接続が切れて途中で死ぬので、複数回に分ける。
#   - **元を消さない**。コピーだけ。失敗しても現状のまま。
#
# 使い方:
#   bin/rails "r2:status[image-palace-production]"     # 差分を数えるだけ（書き込みなし）
#   bin/rails "r2:copy[image-palace-production]"       # コピー（既定 150 件まで）
#   bin/rails "r2:copy[image-palace-production,500]"   # 件数を指定
#   bin/rails "r2:verify[image-palace-production]"     # コピー漏れの確認
namespace :r2 do
  desc "コピー元・コピー先・DB の差分を数える（書き込みなし）"
  task :status, [ :bucket ] => :environment do |_task, args|
    bucket = args[:bucket].presence or abort("バケット名を渡してください")
    report = R2Migration.diff(bucket)

    puts "コピー元 #{report[:source_bucket]}: #{report[:source_keys].size} オブジェクト"
    puts "コピー先 #{bucket}: #{report[:destination_keys].size} オブジェクト"
    puts "DB の blob: #{report[:blob_keys].size} 件 / #{R2Migration.human_size(ActiveStorage::Blob.sum(:byte_size))}"
    puts "-" * 60
    puts "これからコピーするもの: #{report[:to_copy].size} 件"
    puts "コピー済み: #{report[:already].size} 件"
    puts "元に実体が無い blob: #{report[:orphans].size} 件（DB の行だけ残ったもの。コピー対象外）"
    puts "DB に無い迷子ファイル: #{report[:untracked].size} 件（過去の削除漏れ。移行の妨げにはならない）"
    puts ""
    puts "※ 何も書き込んでいません"
  end

  desc "R2 の全オブジェクトを別バケットへコピーする（既にあるものは飛ばす）"
  task :copy, [ :bucket, :limit ] => :environment do |_task, args|
    bucket = args[:bucket].presence or abort("コピー先のバケット名を渡してください")
    limit = (args[:limit].presence || R2Migration::DEFAULT_LIMIT).to_i

    source = ActiveStorage::Blob.service
    destination = R2Migration.destination_service(bucket)
    report = R2Migration.diff(bucket)
    targets = report[:to_copy].to_a.first(limit)

    puts "コピー元: #{report[:source_bucket]} / コピー先: #{bucket}"
    puts "残り #{report[:to_copy].size} 件のうち #{targets.size} 件を処理します"
    puts "-" * 60

    copied = 0
    failures = []

    ActiveStorage::Blob.where(key: targets).find_each(batch_size: 25) do |blob|
      data = source.download(blob.key)
      destination.upload(blob.key, StringIO.new(data), checksum: blob.checksum, content_type: blob.content_type)
      copied += 1
      print "." if (copied % 25).zero?
    rescue StandardError => e
      failures << "#{blob.key}: #{e.class}: #{e.message}"
    end

    remaining = report[:to_copy].size - copied
    puts ""
    puts "-" * 60
    puts "コピーできた: #{copied} 件 / 失敗: #{failures.size} 件"
    puts "まだ残っている: #{remaining} 件#{remaining.positive? ? '（もう一度実行してください）' : ''}"
    if failures.any?
      puts "失敗した分（もう一度実行すれば再試行されます）:"
      failures.first(20).each { |line| puts "  #{line}" }
    end
    puts "※ 元のバケットには手を付けていません"
  end

  desc "コピー漏れを確認する（元にあるものが全てコピー先にあるか）"
  task :verify, [ :bucket ] => :environment do |_task, args|
    bucket = args[:bucket].presence or abort("確認するバケット名を渡してください")
    report = R2Migration.diff(bucket)

    puts "確認した blob: #{report[:blob_keys].size} 件"
    puts "コピー漏れ: #{report[:to_copy].size} 件"
    puts "元にも実体が無い blob: #{report[:orphans].size} 件（コピーしようがないもの。妨げにはならない）"

    if report[:to_copy].any?
      puts "足りないもの:"
      report[:to_copy].to_a.first(20).each { |key| puts "  #{key}" }
      abort("コピー漏れがあります。切り替えないでください。")
    end

    puts "✓ 元にある blob は全てコピー先に存在します"
  end
end

# rake タスクから使う小道具
module R2Migration
  # 1回のコピーで処理する件数。接続が切れて途中で死なないよう区切る
  DEFAULT_LIMIT = 150

  module_function

  # 元・先・DB の3つを突き合わせる。
  # 一覧を1回ずつ取って集合で比べるので、件数が増えても API 呼び出しは増えない
  def diff(bucket)
    source = ActiveStorage::Blob.service
    destination = destination_service(bucket)

    source_keys = list_keys(source)
    destination_keys = list_keys(destination)
    blob_keys = ActiveStorage::Blob.pluck(:key).to_set

    {
      source_bucket: bucket_name(source),
      source_keys: source_keys,
      destination_keys: destination_keys,
      blob_keys: blob_keys,
      # 元にあって先に無い、DB にも載っているもの＝これからコピーするもの
      to_copy: (blob_keys & source_keys) - destination_keys,
      already: blob_keys & destination_keys,
      # DB に行があるのに元に実体が無いもの（過去の失敗や削除漏れ）
      orphans: blob_keys - source_keys,
      # 元にあるのに DB に無いもの（迷子ファイル）
      untracked: source_keys - blob_keys
    }
  end

  def list_keys(service)
    service.bucket.objects.each_with_object(Set.new) { |object, keys| keys << object.key }
  end

  # 既存の R2 設定を読み、バケット名だけ差し替えたサービスを作る。
  # 鍵は既存のものをそのまま使うので、新しい認証情報を用意しない
  def destination_service(bucket)
    configs = Rails.application.config.active_storage.service_configurations
    base = configs["cloudflare_r2"] || configs[:cloudflare_r2]
    raise "cloudflare_r2 の設定が見つかりません" if base.nil?

    merged = base.to_h.transform_keys(&:to_s).merge("bucket" => bucket)
    ActiveStorage::Service.configure(:migration_destination, { "migration_destination" => merged })
  end

  def bucket_name(service)
    service.bucket.name
  rescue StandardError
    "(取得不可)"
  end

  def human_size(bytes)
    "#{(bytes.to_f / 1024 / 1024).round(1)} MB"
  end
end
