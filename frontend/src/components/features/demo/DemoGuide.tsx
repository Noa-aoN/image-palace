'use client'

import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { isDemoUser } from '@/lib/demo/session'
import { DEMO_GUIDE_STEPS, allSeen, demoStepForPath, markSeen } from '@/lib/demo/guide'

/** 見た場所の控え。**この端末にだけ残す**（体験の宮殿は持ち帰らないもの） */
const STORAGE_KEY = 'demo-guide-seen'

/**
 * 控えは画面の外に置く。
 *
 * effect の中で state を動かすと、描いたあとにもう一度描き直すことになる
 * （`useCardDetailColumns` と同じ作りにそろえる）。
 */
const EMPTY: string[] = []
const listeners = new Set<() => void>()
let cache: string[] | null = null

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    // 読めなくても案内は出す（何も見ていない扱い）
    return EMPTY
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function snapshot(): string[] {
  if (cache === null) cache = read()
  return cache
}

/** 見た場所を控える。変わらなければ何もしない（描き直しを起こさない） */
function record(key: string | null) {
  const next = markSeen(snapshot(), key)
  if (next === cache) return

  cache = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 残せなくても案内そのものは動く
  }
  listeners.forEach((listener) => listener())
}

/**
 * 体験の宮殿でだす道案内。
 *
 * **入ってきた人は、何を見ればよいのか分からない。**
 * 部屋の大半は灰色（使えない）なので、示さないと押せる場所を探すところから始まる。
 *
 * 見た場所は済みになり、**3つ見終わったら畳む**（役目を終えたものを残さない）。
 *
 * 帯のすぐ下に置く。帯と同じで、どの画面にいても同じ場所にある。
 */
export function DemoGuide() {
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const pathname = usePathname()
  const seen = useSyncExternalStore(subscribe, snapshot, () => EMPTY)
  const demo = hasHydrated && isDemoUser(user)

  useEffect(() => {
    if (!demo) return
    record(demoStepForPath(pathname))
  }, [pathname, demo])

  if (!demo || allSeen(seen)) return null

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-1.5 text-xs"
      style={{ backgroundColor: 'var(--ivory-dark)' }}
    >
      <span className="text-muted-foreground">まずは、この3つを見てみてください</span>
      {DEMO_GUIDE_STEPS.map((step) => {
        const done = seen.includes(step.key)
        return (
          <Link
            key={step.key}
            href={step.href}
            title={step.hint}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 transition-colors ${
              done ? 'text-muted-foreground line-through' : 'font-medium hover:bg-black/5'
            }`}
            style={done ? undefined : { color: 'var(--palace)' }}
          >
            {/* 済みは印を塗り、まだのものは空の枠にする。
                **色だけに頼らない**（線を引いて、字でも分かるようにする） */}
            {done ? (
              <Check size={12} aria-hidden />
            ) : (
              <span aria-hidden className="size-3 rounded-[3px] border border-current" />
            )}
            {step.label}
          </Link>
        )
      })}
    </div>
  )
}
