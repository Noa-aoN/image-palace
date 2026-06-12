# frozen_string_literal: true

# エラーモニタリング（Sentry）
#
# SENTRY_DSN が設定されている場合のみ初期化する。
# ローカル・テストでは DSN を設定しないため no-op となり、外部送信は発生しない。
# 送信を行うのは staging / production のみ（enabled_environments で制限）。
if ENV["SENTRY_DSN"].present?
  Sentry.init do |config|
    config.dsn = ENV["SENTRY_DSN"]
    config.environment = ENV.fetch("SENTRY_ENVIRONMENT", Rails.env.to_s)
    config.enabled_environments = %w[staging production]
    config.breadcrumbs_logger = %i[active_support_logger http_logger]

    # パフォーマンストレースのサンプリング率（既定 10%）
    config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f

    # 個人情報（PII）はデフォルトで送らない
    config.send_default_pii = false

    # ヘルスチェックなど監視ノイズになるトランザクションは除外する
    config.before_send_transaction = lambda do |event, _hint|
      name = event.transaction.to_s
      name.start_with?("Api::V1::HealthController") ? nil : event
    end
  end
end
