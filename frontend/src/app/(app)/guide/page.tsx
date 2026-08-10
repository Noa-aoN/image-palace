import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'
import { ListRows } from '@/components/features/posts/ListRows'

export const metadata: Metadata = { title: '使い方' }

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <BookOpen size={26} style={{ color: 'var(--palace)' }} />
          使い方
        </h1>
        <p className="mt-2 text-muted-foreground">
          ImagePalace は、覚えたい言葉を「イメージ」に変えて記憶を助けるサービスです。知りたいトピックを選んでください。
        </p>
      </header>

      {/* 使い方は日付を持たない。題名と要約だけを縦に並べる */}
      <div className="mt-8">
        <ListRows
          items={GUIDE_SECTIONS.map((s) => ({
            key: s.slug,
            href: `/guide/${s.slug}`,
            title: s.title,
            excerpt: s.excerpt,
            imageUrl: s.image,
          }))}
        />
      </div>

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
