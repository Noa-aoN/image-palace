'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { getImageModels, type ImageModelChoice } from '@/lib/api/items'

/**
 * 絵を作るモデルの選択。
 *
 * **選べるものが1つしかないときは何も出さない。** 選択肢が1つの選択欄は、
 * 考えることを増やすだけで何も選ばせていない。
 * 鍵を足せば（デプロイ無しで）2つ目が現れ、そのとき初めて出る。
 *
 * 「おまかせ」を先頭に置くのは、決めなくてよいと分かるようにするため。
 */
export function ImageModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (key: string) => void
  disabled?: boolean
}) {
  const [models, setModels] = useState<ImageModelChoice[]>([])

  useEffect(() => {
    getImageModels()
      .then(setModels)
      .catch(() => {})
  }, [])

  if (models.length < 2) return null

  const options = [{ key: '', label: 'おまかせ', description: 'そのときの既定のモデルで作ります。' }, ...models]
  const current = options.find((o) => o.key === value)

  return (
    <div className="space-y-2">
      <Label>絵のモデル</Label>
      <p className="text-xs text-muted-foreground">絵を作る仕組み。得意な絵柄が違います。</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.key
          return (
            <button
              key={opt.key || 'default'}
              type="button"
              onClick={() => onChange(opt.key)}
              disabled={disabled}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              style={active ? { backgroundColor: 'var(--palace)' } : undefined}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {current && <p className="text-xs text-muted-foreground">{current.description}</p>}
    </div>
  )
}
