'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/spinner'
import { PropertyBlock, BlockEmpty } from '@/components/features/items/PropertyBlock'
import { getItemUsages, type ItemUsages } from '@/lib/api/items'

/**
 * このカードがどこで使われているか。
 *
 * カードの項目としては持たせない。配置は view_items / space_points / box_items が
 * 既に持っていて、そちらが正。カード側にも書くと、動かしたときに必ず食い違う。
 * 見たいときに引くだけにする。
 *
 * 読み込みは開いたときの1回だけ。ここは「いま何を覚えているか」ではなく
 * 「どこに置いたか」なので、追いかけて更新するほどの鮮度は要らない。
 */
export function ItemUsageBlock({ itemId }: { itemId: string }) {
  // 「読み込み中」と「引いた結果が空」を1つの状態で表す。
  // 別々に持つと、取り直しの途中で一瞬「置かれていません」と出てしまう
  const [usages, setUsages] = useState<ItemUsages | null>(null)

  useEffect(() => {
    let cancelled = false
    getItemUsages(itemId)
      .then((data) => {
        if (!cancelled) setUsages(data)
      })
      .catch(() => {
        // 引けなくても本体の表示は妨げない。空として扱う
        if (!cancelled) setUsages({ views: [], spaces: [], boxes: [] })
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  const total = usages ? usages.views.length + usages.spaces.length + usages.boxes.length : 0

  return (
    // 読み終えて0件のときだけ地を落とす（読み込み中は判断が付かない）
    <PropertyBlock title="使っている場所" empty={usages !== null && total === 0}>
      {usages === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} />
          読み込み中…
        </p>
      ) : total === 0 ? (
        <BlockEmpty>まだどこにも置かれていません。</BlockEmpty>
      ) : (
        <div className="space-y-1.5">
          <UsageRow label="キャンバス" entries={usages!.views.map((v) => ({ ...v, href: `/views/${v.id}` }))} />
          <UsageRow label="スペース" entries={usages!.spaces.map((s) => ({ ...s, href: `/spaces/${s.id}` }))} />
          <UsageRow label="ボックス" entries={usages!.boxes.map((b) => ({ ...b, href: `/boxes/${b.id}` }))} />
        </div>
      )}
    </PropertyBlock>
  )
}

function UsageRow({
  label,
  entries,
}: {
  label: string
  entries: { id: string; name: string; href: string }[]
}) {
  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={entry.href}
          className="rounded-full px-2.5 py-0.5 text-xs transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--tag-ink)' }}
        >
          {entry.name}
        </Link>
      ))}
    </div>
  )
}
