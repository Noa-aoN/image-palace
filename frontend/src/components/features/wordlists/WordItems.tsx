'use client'

import { useState } from 'react'
import { X, GripVertical, ChevronUp, ChevronDown, Wand2 } from 'lucide-react'
import type { WordCheckIssue, WordVerdict } from '@/lib/api/wordlists'

// AIチェックの判定ラベル。理由とあわせて行に出す。
const VERDICT_LABEL: Record<WordVerdict, string> = {
  off_theme: 'テーマ外',
  duplicate: '重複',
  inappropriate: '不適切',
  typo: '誤記',
}

// 配列の from を to の位置へ移動した新しい配列を返す。
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

type Props = {
  words: string[]
  onChange: (words: string[]) => void
  // AIチェックの指摘（単語 → 指摘）。未チェックなら空。
  issues?: Map<string, WordCheckIssue>
  disabled?: boolean
}

/**
 * ワードリストの単語行。ドラッグ（HTML5 ネイティブ）と ↑↓ ボタンで並び替えでき、削除もできる。
 * AIチェックの指摘があれば、その行にバッジ・理由・置換ボタンを出す（適用は一件ずつ）。
 * 作成ページと詳細ページで共用する。
 */
export function WordItems({ words, onChange, issues, disabled }: Props) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const remove = (index: number) => onChange(words.filter((_, i) => i !== index))
  const move = (from: number, to: number) => onChange(moveItem(words, from, to))

  // 指摘の置換案を適用する（重複するなら足さずに削除するだけ）。
  const replace = (index: number, replacement: string) => {
    const next = [...words]
    if (next.includes(replacement)) {
      next.splice(index, 1)
    } else {
      next[index] = replacement
    }
    onChange(next)
  }

  // 掴めるのはつまみを押している間だけ。
  // 行そのものを draggable にすると、**単語をなぞって写せない**（なぞった時点でドラッグが始まる）
  const [grabbed, setGrabbed] = useState<number | null>(null)

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {words.map((word, i) => {
        const issue = issues?.get(word)
        return (
          <li
            key={`${word}-${i}`}
            draggable={!disabled && grabbed === i}
            onDragStart={() => setDragging(i)}
            onDragEnd={() => {
              setDragging(null)
              setOver(null)
              setGrabbed(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(i)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragging !== null) move(dragging, i)
              setDragging(null)
              setOver(null)
              setGrabbed(null)
            }}
            className={`flex items-start gap-2 px-3 py-2 text-sm transition-colors ${
              over === i && dragging !== null && dragging !== i ? 'bg-[rgba(198,167,94,0.12)]' : ''
            } ${dragging === i ? 'opacity-50' : ''}`}
          >
            {/* ここを押している間だけ動かせる。押していなければただの行なので、
                単語をなぞって写せる */}
            <span
              onPointerDown={() => !disabled && setGrabbed(i)}
              onPointerUp={() => setGrabbed(null)}
              className={`mt-0.5 shrink-0 touch-none text-muted-foreground ${
                disabled ? '' : 'cursor-grab active:cursor-grabbing'
              }`}
              aria-hidden
            >
              <GripVertical size={14} />
            </span>
            <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span>{word}</span>
                {issue && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-3xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    {VERDICT_LABEL[issue.verdict]}
                  </span>
                )}
              </span>
              {issue?.reason && (
                <span className="mt-0.5 block text-xs text-muted-foreground">{issue.reason}</span>
              )}
              {issue?.replacement && (
                <button
                  type="button"
                  onClick={() => replace(i, issue.replacement as string)}
                  disabled={disabled}
                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Wand2 size={12} />「{issue.replacement}」に置き換える
                </button>
              )}
            </span>

            {/* 並び替え（キーボード・タッチ向け。ドラッグの代替） */}
            <span className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={disabled || i === 0}
                aria-label={`${word}を上へ`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={disabled || i === words.length - 1}
                aria-label={`${word}を下へ`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label={`${word}を削除`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive"
              >
                <X size={14} />
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
