'use client'

import { Plus } from 'lucide-react'
import type { ItemPropertyEntry } from '@/lib/api/properties'
import { PROPERTY_CATEGORIES, propertyCategoryOf } from '@/lib/api/properties'

/**
 * まだ書いていない項目。**畳んでおく。**
 *
 * これまでは、定義した項目を全部そのまま並べていた。
 * 20 定義していれば、書いていない18件が「未設定」と並んでカード詳細が縦に伸びる。
 * **書いたものを読みに来た人が、空欄をかき分けることになる。**
 *
 * ここでは名前だけを並べ、押されたものだけを本文へ出す。
 *
 * 役割ごとにまとめる。同じ「まだ書いていない」でも、
 * 覚える対象（記憶要素）と、覚え方（変換要素）と、整理のためのもの（管理要素）は
 * 埋めたくなる場面が違う。
 */
export function PropertyAddBlock({
  entries,
  onReveal,
}: {
  entries: ItemPropertyEntry[]
  onReveal: (key: string) => void
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        書ける項目は、ぜんぶ書いてあります。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        押すと、その項目を書けるようになります（{entries.length} 件）
      </p>

      {PROPERTY_CATEGORIES.map((role) => {
        const rows = entries.filter(
          (entry) => propertyCategoryOf(entry.category).key === role.key
        )
        if (rows.length === 0) return null

        return (
          <div key={role.key} className="space-y-1.5">
            <p className="text-2xs font-medium" style={{ color: role.accent }} title={role.hint}>
              {role.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => onReveal(entry.key)}
                  title={entry.description ?? undefined}
                  // **薄いまま置く。** 書いてあるものと同じ濃さで並べると、
                  // どれが書いてあるのか読み取れなくなる
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-[var(--palace)] hover:text-foreground"
                >
                  <Plus size={11} />
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
