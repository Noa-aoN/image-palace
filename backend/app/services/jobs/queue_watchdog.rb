# frozen_string_literal: true

module Jobs
  # ジョブのワーカーが生きているかを見張る。
  #
  # ワーカーは app とは別のマシンで動いている（#340 で分離した）。分離したことで
  # Puma を圧迫しなくなった代わりに、**ワーカーだけ落ちても Web は正常に見える**という
  # 失敗の仕方が生まれた。実際 2026-08-09 にデプロイ後のワーカーが停止したまま戻らず、
  # カードが「生成待ち」のまま止まり続けた（33件が滞留）。
  #
  # ワーカーの中で見張っても、ワーカーが死んでいたら誰も気づけない。だから
  # app 側（health チェックの経路）から呼ぶ。
  module QueueWatchdog
    module_function

    # この時間より新しい心拍があれば「生きている」とみなす
    ALIVE_WINDOW = 3.minutes
    # 通知の間引き（同じ事象で鳴らし続けない）
    ALERT_INTERVAL = 15.minutes
    ALERT_CACHE_KEY = "jobs:queue_watchdog:alerted"

    Status = Struct.new(:ready, :claimed, :workers, :last_heartbeat_at, :stalled, keyword_init: true)

    def status(now: Time.current)
      last_heartbeat = SolidQueue::Process.maximum(:last_heartbeat_at)
      ready = SolidQueue::ReadyExecution.count
      alive = last_heartbeat.present? && last_heartbeat > now - ALIVE_WINDOW

      Status.new(
        ready: ready,
        claimed: SolidQueue::ClaimedExecution.count,
        workers: SolidQueue::Process.count,
        last_heartbeat_at: last_heartbeat,
        # 積まれているのに動かしている者がいない＝止まっている
        stalled: ready.positive? && !alive
      )
    end

    # 止まっていれば知らせる。呼び出し元（health）を壊さないよう、失敗は握りつぶす
    def check!(now: Time.current)
      current = status(now: now)
      return current unless current.stalled
      return current unless Rails.cache.write(ALERT_CACHE_KEY, true, unless_exist: true, expires_in: ALERT_INTERVAL)

      message = "[jobs] ワーカーが動いていません ready=#{current.ready} " \
                "最後の心拍=#{current.last_heartbeat_at || 'なし'}"
      Rails.logger.error(message)
      Sentry.capture_message(message, level: :error) if defined?(Sentry)

      current
    rescue StandardError => e
      Rails.logger.warn "[jobs] 監視に失敗しました #{e.class}: #{e.message}"
      nil
    end
  end
end
