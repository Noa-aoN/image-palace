# デプロイ/再起動で Solid Queue のワーカーが pruned（ProcessPrunedError）されると、
# 処理中だった画像生成ジョブが失われ、対象が pending/processing のまま
# 取り残される（＝UI で「生成中」のまま進まない）。
#
# この定期ジョブが stale な孤児を検出し、対応する生成ジョブを冪等に再エンキューして
# 自動復旧する。対象は 2 系統:
#   - Item             → GenerateImageJob
#   - SpacePoint(named) → GeneratePointImageJob
# どちらの生成ジョブも with_lock ＋ completed スキップ ＋ キャッシュ確認で冪等なので、
# 万一まだ生きているジョブと二重に走っても安全。
class RecoverStuckGenerationsJob < ApplicationJob
  queue_as :default

  # これ以上 pending/processing のままなら孤児とみなすしきい値。
  # 通常の生成はリトライ込み（15s→60s→240s）でも数分で終わるため 15 分は十分な安全マージン。
  STUCK_AFTER = Integer(ENV.fetch("STUCK_GENERATION_AFTER_SECONDS", 15 * 60)).seconds
  # 1 回のスイープで再エンキューする最大件数（暴走防止）。系統ごとに適用。
  BATCH_LIMIT = Integer(ENV.fetch("STUCK_GENERATION_BATCH_LIMIT", 500))

  def perform
    cutoff = STUCK_AFTER.ago

    # force_generate は付けない: キャッシュ済みなら OpenAI 呼び出しゼロで復旧する。
    items = reenqueue(Item.stuck_generation(cutoff)) { |id| GenerateImageJob.perform_later(id) }
    # 空ポイント（name 無し）は生成対象外なので named に限定する。
    points = reenqueue(SpacePoint.named.stuck_generation(cutoff)) { |id| GeneratePointImageJob.perform_later(id) }

    total = items + points
    if total.positive?
      Rails.logger.info(
        "[RecoverStuckGenerationsJob] re-enqueued items=#{items} points=#{points} cutoff=#{cutoff.utc.iso8601}"
      )
    end

    total
  end

  private

  def reenqueue(scope)
    ids = scope.limit(BATCH_LIMIT).pluck(:id)
    ids.each { |id| yield id }
    ids.size
  end
end
