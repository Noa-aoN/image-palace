'use client'

import { useCallback, useRef, useState } from 'react'
import { ShapeEditBody } from '@/components/features/panel/ShapeEditBody'
import { persist } from '@/lib/api/persist'
import { removeViewShape, updateViewShape } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { BoardShape, BoardShapeStyle } from '@/types/view'

/** 打っている間は送らない待ち時間(ms)。1文字ごとに送ると、盤が保存で埋まる */
const TYPING_DELAY = 500

/**
 * 図形の編集を、盤とサーバへ橋渡しする。
 *
 * **画面はすぐ変え、保存は遅らせる。** 打った文字が出るまで待たされると
 * 打ちにくいが、1文字ごとに送るのは無駄が多い。
 */
export function ShapePanel({ viewId, shape }: { viewId: string; shape: BoardShape }) {
  const [current, setCurrent] = useState(shape)
  const requestShapePatch = useRightPanelStore((s) => s.requestShapePatch)
  const requestShapeRemove = useRightPanelStore((s) => s.requestShapeRemove)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const change = useCallback(
    (patch: { text?: string | null; style?: BoardShapeStyle }) => {
      // 見た目は**足し合わせる**。一部だけ変えたときに、他が消えないように
      const next: BoardShape = {
        ...current,
        text: patch.text !== undefined ? patch.text : current.text,
        style: patch.style ? { ...current.style, ...patch.style } : current.style,
      }
      setCurrent(next)
      // 盤の見た目も、待たせずに変える
      requestShapePatch(next)

      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        persist(() => updateViewShape(viewId, next.id, { text: next.text, style: patch.style }), {
          key: `view:${viewId}:shape:${next.id}:style`,
        })
      }, TYPING_DELAY)
    },
    [current, viewId, requestShapePatch]
  )

  const remove = useCallback(() => {
    requestShapeRemove(current.id)
    persist(() => removeViewShape(viewId, current.id), {
      key: `view:${viewId}:shape:${current.id}:remove`,
    })
  }, [current.id, viewId, requestShapeRemove])

  return <ShapeEditBody shape={current} onChange={change} onRemove={remove} />
}
