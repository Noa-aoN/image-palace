# frozen_string_literal: true

# R2 のバケット引っ越し。
#
# 本番バケットが image-palace-staging という紛らわしい名前のままなので、
# 誤削除を避けるために image-palace-production へ移す。
#
# 設計:
#   - 認証情報は既存の R2 のものをそのまま使い、**バケット名だけ差し替える**。
#     新しい鍵を作らないので、鍵の受け渡しで漏らす経路が増えない。
#   - **何度でも実行できる**。コピー済みのものは飛ばすので、途中で切れても
#     もう一度流せば続きから埋まる。切り替え直前にもう一度流して、
#     コピー中に増えたぶんを拾うのが正しい使い方。
#   - **元を消さない**。コピーだけ。失敗しても現状のまま。
#
# 使い方:
#   bin/rails "r2:copy[image-palace-production]"        # コピー（何度でも可）
#   bin/rails "r2:verify[image-palace-production]"      # コピー漏れの確認
#   bin/rails "r2:copy[image-palace-production,true]"   # 下見だけ（書き込まない）
namespace :r2 do
  desc "R2 の全オブジェクトを別バケットへコピーする（既にあるものは飛ばす）"
  task :copy, [ :bucket, :dry_run ] => :environment do |_task, args|
    bucket = args[:bucket].presence or abort("コピー先のバケット名を渡してください")
    dry_run = args[:dry_run].to_s == "true"

    source = ActiveStorage::Blob.service
    destination = R2Migration.destination_service(bucket)

    puts "コピー元: #{R2Migration.bucket_name(source)}"
    puts "コピー先: #{bucket}#{dry_run ? '（下見のみ・書き込みません）' : ''}"
    puts "対象: #{ActiveStorage::Blob.count} 件 / #{R2Migration.human_size(ActiveStorage::Blob.sum(:byte_size))}"
    puts "-" * 60

    copied = skipped = failed = 0
    # DB に行があるのに実体が無い blob（過去の失敗や削除漏れ）。
    # これを失敗として扱うと移行が止まるので、別枠で数えて先へ進める
    orphans = []
    failures = []

    ActiveStorage::Blob.find_each(batch_size: R2Migration::BATCH_SIZE) do |blob|
      if destination.exist?(blob.key)
        skipped += 1
        next
      end

      # 元に無いものはコピーしようがない。飛ばして記録する
      unless source.exist?(blob.key)
        orphans << blob.key
        next
      end

      if dry_run
        copied += 1
        next
      end

      begin
        # ダウンロードしてから上げ直す。R2 同士でも間に Rails を挟む方が、
        # 認証情報を1組で済ませられる（1件あたり数百KB なので所要時間も問題にならない）
        data = source.download(blob.key)
        destination.upload(blob.key, StringIO.new(data), checksum: blob.checksum, content_type: blob.content_type)
        copied += 1
      rescue StandardError => e
        failed += 1
        failures << "#{blob.key}: #{e.class}: #{e.message}"
      end

      print "." if ((copied + skipped) % 25).zero?
    end

    puts ""
    puts "-" * 60
    puts "コピー: #{copied} / 既存のため飛ばした: #{skipped} / 失敗: #{failed}"
    if orphans.any?
      puts "元に実体が無かった blob: #{orphans.size} 件（DB の行だけ残ったもの。コピー対象外）"
      orphans.first(20).each { |key| puts "  #{key}" }
    end
    if failures.any?
      puts "失敗した分（もう一度実行すれば再試行されます）:"
      failures.first(20).each { |line| puts "  #{line}" }
    end
    puts dry_run ? "※ 下見のみ。何も書き込んでいません" : "※ 元のバケットには手を付けていません"
  end

  desc "コピー漏れを確認する（DB の全 blob がコピー先に存在するか）"
  task :verify, [ :bucket ] => :environment do |_task, args|
    bucket = args[:bucket].presence or abort("確認するバケット名を渡してください")
    destination = R2Migration.destination_service(bucket)

    source = ActiveStorage::Blob.service
    missing = []
    orphans = []
    checked = 0

    ActiveStorage::Blob.find_each(batch_size: R2Migration::BATCH_SIZE) do |blob|
      checked += 1
      next if destination.exist?(blob.key)

      # 元にも無いなら、コピー漏れではなく元々存在しない blob。移行の妨げにはしない
      if source.exist?(blob.key)
        missing << blob.key
      else
        orphans << blob.key
      end
      print "." if (checked % 50).zero?
    end

    puts ""
    puts "-" * 60
    puts "確認したもの: #{checked} 件"
    puts "コピー漏れ: #{missing.size} 件"
    puts "元にも実体が無い blob: #{orphans.size} 件（移行の妨げにはなりません）" if orphans.any?
    if missing.any?
      puts "足りないもの（r2:copy をもう一度流してください）:"
      missing.first(20).each { |key| puts "  #{key}" }
      abort("コピー漏れがあります。切り替えないでください。")
    end

    puts "✓ DB 上の全 blob がコピー先に存在します"
  end

  # 実バケットの中身も突き合わせる（DB に無い迷子ファイルの有無を見る）
  desc "コピー元とコピー先のオブジェクト数を突き合わせる"
  task :compare, [ :bucket ] => :environment do |_task, args|
    bucket = args[:bucket].presence or abort("比較するバケット名を渡してください")

    source_bucket = R2Migration.bucket_name(ActiveStorage::Blob.service)
    puts "#{source_bucket}: #{R2Migration.object_count(source_bucket)} オブジェクト"
    puts "#{bucket}: #{R2Migration.object_count(bucket)} オブジェクト"
    puts "DB の blob: #{ActiveStorage::Blob.count} 件"
    puts "※ 実バケットの方が多い場合、DB に無い迷子ファイル（過去の削除漏れ）です。移行の妨げにはなりません"
  end
end

# rake タスクから使う小道具
module R2Migration
  # 一度に読む件数。1回の実行を短く保ち、途中で切れても再開できるようにする
  BATCH_SIZE = 50

  module_function

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

  def object_count(bucket)
    service = destination_service(bucket)
    service.bucket.objects.count
  rescue StandardError => e
    "(取得できません: #{e.class})"
  end

  def human_size(bytes)
    "#{(bytes.to_f / 1024 / 1024).round(1)} MB"
  end
end
