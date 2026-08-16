'use client'

import { useEffect } from 'react'
import { Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RewardRow } from '@/lib/api/achievements'
import { rarityStyle } from './rarity'
import { RewardArt, RarityMarks, STAR_VERB } from './RewardCard'

/**
 * 獲得物の詳細。
 *
 * 狭い画面ではホバーが無いので、押したら下から出る一枚で見せる。
 * 広い画面でも同じものを中央に出す。**同じ中身を2つ作らない**（必ず片方が古くなる）。
 *
 * 出すのは「何か・どのくらい珍しいか・どうすれば手に入るか・いつ手に入れたか」。
 * 一覧に全部書くと札が縦に伸びて、並べて眺められなくなる。
 */
export function RewardDetail({
  reward,
  onClose,
  onToggleStar,
  busy,
}: {
  reward: RewardRow
  onClose: () => void
  onToggleStar: () => void
  busy: boolean
}) {
  const style = rarityStyle(reward.rarity_tier)
  const verb = STAR_VERB[reward.kind]

  // 開いている間は背後を動かさない。閉じ方は Escape も用意する
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={reward.name}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm space-y-4 rounded-t-2xl border bg-card p-5 sm:rounded-2xl ${style.frame}`}
        style={style.glow ? { boxShadow: style.glow } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <RewardArt reward={reward} size={56} />
            <div>
              <p className="font-semibold">{reward.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {reward.kind_label}
                <RarityMarks level={reward.rarity_level} tierClass={style.text} />
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {reward.description && <p className="text-sm text-muted-foreground">{reward.description}</p>}

        {/* 並べるのは3つに決める。獲得・分類・条件。
            持っているかどうかで項目が入れ替わると、見るたびに探すことになる */}
        <dl className="space-y-2 border-t border-border pt-3 text-sm">
          <Row label="獲得">
            {reward.owned ? (
              reward.granted_at ? (
                new Date(reward.granted_at).toLocaleDateString('ja-JP')
              ) : (
                '獲得済み'
              )
            ) : (
              <span className="text-muted-foreground">まだ</span>
            )}
          </Row>
          <Row label="分類">{reward.category ?? '—'}</Row>
          <Row label={reward.plan_rank ? '持てる条件' : '条件'}>
            {reward.condition ?? '運営から贈られます'}
            {!reward.owned && reward.target ? (
              <span className="ml-1 tabular-nums text-muted-foreground">
                （{reward.progress} / {reward.target}）
              </span>
            ) : null}
          </Row>
        </dl>

        {/* 位だけは、持ち方が他と違う。**稼いで取るものではなく、契約している間だけ持つ**。
            ここを書かないと、解約したときに「獲得したものが消えた」と映る。
            名乗りが自由であることも併せて言う（位＝名乗りだと思われないように） */}
        {reward.plan_rank && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            この位はプランに付いてくるものです。プランを変えると入れ替わり、やめると外れます。
            名乗りは、持っている称号から自由に選べます。
          </p>
        )}

        {reward.owned && (
          <div className="space-y-1.5 border-t border-border pt-3">
            <Button
              variant={reward.starred ? 'default' : 'outline'}
              size="sm"
              disabled={busy}
              onClick={onToggleStar}
              className="flex items-center gap-1.5 text-xs"
            >
              <Star size={13} fill={reward.starred ? 'currentColor' : 'none'} />
              {reward.starred ? verb.on : verb.off}
            </Button>
            <p className="text-xs text-muted-foreground">{verb.place}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
