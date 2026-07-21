import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'

export const metadata: Metadata = { title: '使い方' }

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <BookOpen size={26} style={{ color: 'var(--palace)' }} />
          使い方
        </h1>
        <p className="mt-2 text-muted-foreground">
          ImagePalace は、覚えたい言葉を「イメージ」に変えて記憶を助けるサービスです。知りたいトピックを選んでください。
        </p>
      </header>

      <ul className="mt-8 space-y-4">
        {GUIDE_SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <li key={s.slug}>
              <Link
                href={`/guide/${s.slug}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon size={20} style={{ color: 'var(--palace)' }} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold leading-snug">{s.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.excerpt}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/entrance">
          <Button>さっそく始める</Button>
        </Link>
        <Link href="/blog">
          <Button variant="outline">コラムを読む</Button>
        </Link>
      </div>
    </div>
  )
}
