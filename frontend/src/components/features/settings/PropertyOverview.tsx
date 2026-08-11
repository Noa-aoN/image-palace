'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { PROPERTY_VALUE_TYPE_LABELS, type PropertyDefinition } from '@/lib/api/properties'
import type { ItemType } from '@/types/item'

/**
 * 自分が作った項目を、種別をまたいで一望する。
 *
 * これまでは種別ごとの割り当てしか見えず、「読み仮名をどの種別に入れたか」を
 * 確かめるには、種別を1つずつ開いて回るしかなかった。
 * 同じ名前を別の識別名で作ってしまう事故も、ここが無いと気づけない。
 *
 * ここは**見る場所**にする。作る・消すのは下の種別ごとの欄で行う。
 * 同じ操作を2か所に置くと、どちらで何が起きたのか追えなくなる。
 */
export function PropertyOverview({
  definitions,
  itemTypes,
}: {
  definitions: PropertyDefinition[]
  itemTypes: ItemType[]
}) {
  const [query, setQuery] = useState('')

  // 識別名でまとめる。同じ識別名なら、種別が違っても同じ項目として扱っている
  const grouped = new Map<string, { label: string; valueTypes: Set<string>; typeIds: string[] }>()
  definitions.forEach((definition) => {
    const row = grouped.get(definition.key)
    if (row) {
      row.valueTypes.add(definition.value_type)
      row.typeIds.push(definition.item_type_id)
    } else {
      grouped.set(definition.key, {
        label: definition.label,
        valueTypes: new Set([definition.value_type]),
        typeIds: [definition.item_type_id],
      })
    }
  })

  const keyword = query.trim().toLowerCase()
  const rows = [...grouped.entries()]
    .filter(([key, row]) => !keyword || key.includes(keyword) || row.label.toLowerCase().includes(keyword))
    .sort((a, b) => b[1].typeIds.length - a[1].typeIds.length)

  const typeLabel = (id: string) => itemTypes.find((t) => t.id === id)?.label ?? '—'

  if (definitions.length === 0) return null

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">作った項目</h2>
        <p className="text-sm text-muted-foreground">{rows.length} 種類</p>
      </div>

      {definitions.length > 8 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="項目を探す"
            aria-label="項目を探す"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      <ul className="divide-y divide-border border-y border-border">
        {rows.map(([key, row]) => (
          <li key={key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
            <span className="font-medium">{row.label}</span>
            <span className="font-mono text-xs text-muted-foreground">{key}</span>
            <span className="text-xs text-muted-foreground">
              {[...row.valueTypes].map((t) => PROPERTY_VALUE_TYPE_LABELS[t as never] ?? t).join('・')}
            </span>
            {/* どの種別で使っているか。ここが分からないと、消してよいか判断できない */}
            <span className="ml-auto flex flex-wrap justify-end gap-1">
              {row.typeIds.map((id) => (
                <span key={id} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {typeLabel(id)}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      {rows.length === 0 && <p className="py-3 text-sm text-muted-foreground">見つかりませんでした。</p>}

      <p className="text-xs text-muted-foreground">
        足す・消すのは、下の種別ごとの欄で行います。
      </p>
    </section>
  )
}
