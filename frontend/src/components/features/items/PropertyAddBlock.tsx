'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import {
  PROPERTY_CATEGORIES,
  PROPERTY_PRESETS,
  propertyCategoryOf,
  createPropertyDefinition,
  type ItemPropertyEntry,
  type PropertyCategory,
} from '@/lib/api/properties'
import { getItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * まだこのカードに出ていない項目。**押せば、その場で出る。**
 *
 * ## なぜひとまとめにするか
 *
 * これまで「出ていない項目」は2か所に分かれていた。
 *
 *   ・**未設定**（この種別に項目はあるが、このカードは空）… カード詳細の「追加できる項目」
 *   ・**まだ無い**（項目そのものが作られていない）… ライトパネルの「まだ無い項目を作る」
 *
 * だが読む側にとって、その違いは**中の作りの話**でしかない。
 * 「この語に語源を書きたい」と思ったとき、語源の項目が作られているかどうかは、
 * 探し始める前には分からない。**2か所を行き来させる理由が無い。**
 *
 * ここでは両方を1つの並びにして、役割（記憶要素・変換要素・管理要素）で分ける。
 * 埋めたくなる場面が違うのは役割のほうで、作られているかどうかではない。
 *
 * ## 押したときに起きること
 *
 * どちらも**一度押せば書ける状態になる**。
 * 項目がまだ無いものは、先に種別の項目として作ってから出す（種別のカード全部に出る）。
 */
export function PropertyAddBlock({
  item,
  entries,
  onReveal,
  onUpdated,
}: {
  item: Item
  entries: ItemPropertyEntry[]
  onReveal: (key: string) => void
  onUpdated: (item: Item) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const itemTypeId = item.item_type?.id

  // 既に持っている鍵。作られていない項目の候補から外す
  const owned = new Set((item.properties ?? []).map((entry) => entry.key))

  // まだ作られていない項目。**種別が分からないカードには出さない**（作る先が無い）
  const uncreated = itemTypeId
    ? PROPERTY_PRESETS.flatMap((group) =>
        group.items
          .filter((preset) => !owned.has(preset.key))
          .map((preset) => ({ ...preset, category: group.category, created: false as const }))
      )
    : []

  const existing = entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    description: entry.description ?? null,
    category: propertyCategoryOf(entry.category).key as PropertyCategory,
    created: true as const,
  }))

  const all = [...existing, ...uncreated]

  if (all.length === 0) {
    return <p className="text-sm text-muted-foreground">書ける項目は、ぜんぶ書いてあります。</p>
  }

  const add = async (candidate: (typeof all)[number]) => {
    // 既にある項目は、その場で出すだけ。**待たせない**
    if (candidate.created) {
      onReveal(candidate.key)
      return
    }
    if (!itemTypeId) return

    setBusy(candidate.key)
    setError(null)
    try {
      const preset = PROPERTY_PRESETS.flatMap((group) => group.items).find((p) => p.key === candidate.key)
      if (!preset) return

      // 説明も一緒に持たせる。作ったあと「これは何を入れる項目だったか」を
      // 思い出せるようにしておく
      await createPropertyDefinition({
        item_type_id: itemTypeId,
        key: preset.key,
        label: preset.label,
        value_type: preset.value_type,
        description: preset.description,
      })
      onUpdated(await getItem(item.id))
      // 作ったものは、そのまま書ける状態にする（もう一度押させない）
      onReveal(preset.key)
    } catch {
      setError('足せませんでした。同じ識別名の項目が既にあるかもしれません。')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        押すと、その項目をこのカードに出します（{all.length} 件）
      </p>

      {PROPERTY_CATEGORIES.map((role) => {
        const rows = all.filter((candidate) => candidate.category === role.key)
        if (rows.length === 0) return null

        return (
          <div key={role.key} className="space-y-1.5">
            <p className="text-2xs font-medium" style={{ color: role.accent }} title={role.hint}>
              {role.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((candidate) => (
                <button
                  key={`${candidate.created ? 'has' : 'new'}:${candidate.key}`}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => add(candidate)}
                  title={candidate.description ?? undefined}
                  // **薄いまま置く。** 書いてあるものと同じ濃さで並べると、
                  // どれが書いてあるのか読み取れなくなる
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-[var(--palace)] hover:text-foreground disabled:opacity-60"
                >
                  {busy === candidate.key ? <Spinner size={11} /> : <Plus size={11} />}
                  {candidate.label}
                  {/* まだ作られていない項目は、種別ぜんぶに出る。そうと分かるようにする */}
                  {!candidate.created && <span className="text-3xs opacity-70">新</span>}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-2xs text-muted-foreground">
        「新」が付いたものは、この種別（{item.item_type?.label ?? '種別なし'}）の項目として新しく作られ、
        同じ種別のカード全部に出ます。
      </p>
    </div>
  )
}
