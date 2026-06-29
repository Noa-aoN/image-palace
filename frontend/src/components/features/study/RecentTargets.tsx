'use client'

import { GalleryHorizontal, Library, LayoutGrid, Star } from 'lucide-react'
import { useStudyTargetStore, toQuizTarget, type SavedTarget } from '@/stores/studyTargets'
import type { QuizTarget } from '@/lib/quiz'

function kindIcon(kind: SavedTarget['kind']) {
  if (kind === 'all') return <GalleryHorizontal size={15} />
  if (kind === 'collection') return <Library size={15} />
  return <LayoutGrid size={15} />
}

interface Props {
  selectedKey?: string
  onSelect: (target: QuizTarget) => void
}

// ①で★を付けて保存した対象をチップで表示し、ワンタップで選び直せる。★で保存解除。
export function RecentTargets({ selectedKey, onSelect }: Props) {
  const targets = useStudyTargetStore((s) => s.targets)
  const toggleSave = useStudyTargetStore((s) => s.toggleSave)

  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">①の対象の★を押すと、ここに保存されます。</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((t) => {
        const active = t.key === selectedKey
        const quizTarget = toQuizTarget(t)
        return (
          <div
            key={t.key}
            className="flex items-center gap-1 rounded-full border bg-card pl-3 pr-1.5 py-1 text-sm transition"
            style={{
              borderColor: active ? 'var(--palace)' : 'var(--border)',
              backgroundColor: active ? 'rgba(198,167,94,0.08)' : undefined,
            }}
          >
            <button type="button" onClick={() => onSelect(quizTarget)} className="flex items-center gap-1.5">
              <span style={{ color: 'var(--palace)' }}>{kindIcon(t.kind)}</span>
              <span className="max-w-40 truncate font-medium">{t.name}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSave(quizTarget)}
              aria-label="保存を外す"
              className="rounded-full p-1 text-[var(--palace)] hover:opacity-70"
            >
              <Star size={14} fill="var(--palace)" color="var(--palace)" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
