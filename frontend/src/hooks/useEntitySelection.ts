'use client'

import { useCallback, useState } from 'react'

/**
 * 一覧の選択モード。キャンバス・スペース・ボックスで同じ動きにする。
 *
 * 選択中は札を押しても移動しない（押した先で「戻る」を強いられるため）。
 * 呼び出し側は `selecting` を見て、リンクをボタンに差し替える。
 *
 * 一覧が入れ替わった（削除・作成・並べ替え）ときに、消えた id を選択に残さない。
 * 残すと「3件選択中」なのに2件しか消えない、が起きる。
 */
export function useEntitySelection<T extends { id: string }>(rows: T[]) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((current) => (current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id))))
  }, [rows])

  const start = useCallback(() => setSelecting(true), [])

  const exit = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])

  /**
   * 選んだものへ順に処理を通す。1件ずつなのは、まとめて消す口をサーバーに
   * 用意していないため（入れ物の削除は数が少なく、速さより確実さが要る）。
   * 途中で失敗しても、成功したぶんは呼び出し側で取り除ける。
   */
  const run = useCallback(
    async (action: (id: string) => Promise<void>): Promise<{ done: string[]; failed: number }> => {
      setBusy(true)
      const done: string[] = []
      let failed = 0
      try {
        for (const id of selected) {
          try {
            await action(id)
            done.push(id)
          } catch {
            failed += 1
          }
        }
      } finally {
        setBusy(false)
        setSelecting(false)
        setSelected(new Set())
      }
      return { done, failed }
    },
    [selected]
  )

  return { selecting, selected, busy, toggle, toggleAll, start, exit, run }
}
