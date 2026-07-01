# デプロイ/再起動で Solid Queue のワーカーが pruned（ProcessPrunedError）されると、
# 処理中だった GenerateImageJob が失われ、アイテムが pending/processing のまま
# 取り残される（＝UI で「生成中」のまま進まない）。
#
# この定期ジョブが stale な孤児を検出し、GenerateImageJob を冪等に再エンキューして
# 自動復旧する。GenerateImageJob は with_lock ＋ completed スキップ ＋ キャッシュ確認で
# 冪等なので、万一まだ生きているジョブと二重に走っても安全。
class RecoverStuckGenerationsJob < ApplicationJob
  queue_as :default

  # これ以上 pending/processing のままなら孤児とみなすしきい値。
  # 通常の生成はリトライ込み（15s→60s→240s）でも数分で終わるため 15 分は十分な安全マージン。
  STUCK_AFTER = Integer(ENV.fetch("STUCK_GENERATION_AFTER_SECONDS", 15 * 60)).seconds
  # 1 回のスイープで再エンキューする最大件数（暴走防止）。
  BATCH_LIMIT = Integer(ENV.fetch("STUCK_GENERATION_BATCH_LIMIT", 500))

  def perform
    cutoff = STUCK_AFTER.ago
    stuck = Item.stuck_generation(cutoff).limit(BATCH_LIMIT)
    recovered = 0

    stuck.each do |item|
      # force_generate は付けない: キャッシュ済みなら OpenAI 呼び出しゼロで復旧する。
      GenerateImageJob.perform_later(item.id)
      recovered += 1
    end

    if recovered.positive?
      Rails.logger.info(
        "[RecoverStuckGenerationsJob] re-enqueued=#{recovered} cutoff=#{cutoff.utc.iso8601}"
      )
    end

    recovered
  end
end
