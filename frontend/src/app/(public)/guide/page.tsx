import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StartLink } from '@/components/features/shared/StartLink'
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/seo/structured-data'
import { shareImage } from '@/lib/seo/share-image'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'
import { ListRows } from '@/components/features/posts/ListRows'
import { BoardBackLink } from '@/components/features/posts/BoardBackLink'

const TITLE = '使い方'
const DESCRIPTION = 'はじめ方・できること・用語・よくある質問。ImagePalace の使い方をまとめています。'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/guide' },
  openGraph: {
    type: 'website', title: TITLE, description: DESCRIPTION, url: '/guide',
    images: [shareImage('guide')],
  },
  twitter: { card: 'summary_large_image', images: [shareImage('guide')] },
}

export default function GuidePage() {
  // 静的な定数のみ埋め込む（利用者の入力は入らないため XSS の経路にならない）
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: TITLE,
      description: DESCRIPTION,
      url: absoluteUrl('/guide'),
      inLanguage: 'ja',
      hasPart: GUIDE_SECTIONS.map((section) => ({
        '@type': 'TechArticle',
        headline: section.title,
        url: absoluteUrl(`/guide/${section.slug}`),
      })),
    },
    breadcrumbJsonLd([
      { name: 'ホーム', path: '/' },
      { name: TITLE, path: '/guide' },
    ]),
  ]

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BoardBackLink />
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
        {/* まだログインしていない人を持ち物の前へ送っても、門で追い返される */}
        <StartLink href="/entrance">
          <Button>さっそく始める</Button>
        </StartLink>
        <Link href="/blog">
          <Button variant="outline">コラムを読む</Button>
        </Link>
      </div>
    </div>
  )
}
