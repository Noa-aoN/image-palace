'use client'

import { useCallback, useEffect, useState } from 'react'
import { Boxes } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'
import { CardPropertiesEditor } from '@/components/features/settings/CardPropertiesEditor'
import { getItemTypes } from '@/lib/api/items'
import { getPropertyDefinitions, type PropertyDefinition } from '@/lib/api/properties'
import type { ItemType } from '@/types/item'

/**
 * カードが持つ項目を、種別をまたいで一望する場所。
 *
 * これまで項目を触れるのはカード詳細の右パネルだけで、
 * 「いま何をどの種別に持たせているのか」を確かめるには
 * その種別のカードを1枚開くしかなかった。棚が育つほど辛くなる。
 *
 * 効く範囲は変わらない（項目は種別ごと）。見る場所を1つ増やしただけ。
 */
export default function CardPropertiesPage() {
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [definitions, setDefinitions] = useState<PropertyDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [types, defs] = await Promise.all([getItemTypes(), getPropertyDefinitions()])
      setItemTypes(types)
      setDefinitions(defs)
      setError(null)
    } catch {
      setError('読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Breadcrumb items={[{ href: '/settings', label: '環境設定' }, { label: 'カードの項目' }]} />

      <div className="mt-2 flex items-center gap-2">
        <Boxes size={20} style={{ color: 'var(--palace)' }} />
        <h1 className="text-2xl font-semibold">カードの項目</h1>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        カードに持たせる項目を、種別ごとに決めます。ここで足した項目は、その種別のカード全部に出ます。
        <br />
        1枚だけ出す・隠す・並べ替えたいときは、カード詳細の「表示」から変えられます。
      </p>

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {itemTypes.map((type) => (
            <CardPropertiesEditor
              key={type.id}
              itemType={type}
              definitions={definitions.filter((d) => d.item_type_id === type.id)}
              onChanged={load}
            />
          ))}
          {itemTypes.length === 0 && <p className="text-sm text-muted-foreground">種別がありません。</p>}
        </div>
      )}
    </div>
  )
}
