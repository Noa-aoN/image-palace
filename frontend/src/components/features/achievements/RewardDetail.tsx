'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RewardRow } from '@/lib/api/achievements'
import { rarityStyle } from './rarity'
import { RewardArt, RarityMarks } from './RewardCard'

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
  onEquip,
  onFeature,
  busy,
}: {
  reward: RewardRow
  onClose: () => void
  onEquip: () => void
  onFeature: () => void
  busy: boolean
}) {
  const style = rarityStyle(reward.rarity_tier)

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
          <Row label="条件">
            {reward.condition ?? '運営から贈られます'}
            {!reward.owned && reward.target ? (
              <span className="ml-1 tabular-nums text-muted-foreground">
                （{reward.progress} / {reward.target}）
              </span>
            ) : null}
          </Row>
        </dl>

        {reward.owned && (reward.equippable || reward.featurable) && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {reward.equippable && (
              <Button
                variant={reward.equipped ? 'default' : 'outline'}
                size="sm"
                disabled={busy}
                onClick={onEquip}
                className="text-xs"
              >
                {reward.equipped ? '名乗っている' : '名乗る'}
              </Button>
            )}
            {reward.featurable && (
              <Button
                variant={reward.featured ? 'default' : 'outline'}
                size="sm"
                disabled={busy}
                onClick={onFeature}
                className="text-xs"
              >
                {reward.featured ? '掲げている' : '掲げる'}
              </Button>
            )}
          </div>
        )}

        {reward.owned && reward.room_displayable && (
          <p className="text-xs text-muted-foreground">マイルームに飾れるようにする準備をしています。</p>
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
