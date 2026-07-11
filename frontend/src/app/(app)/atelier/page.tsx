import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Boxes, GalleryHorizontal, Box, LayoutGrid, Frame } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'アトリエ' }

const CREATE_ACTIONS: { href: string; icon: ReactNode; label: string; description: string }[] = [
  { href: '/materials/new', icon: <Boxes size={20} />, label: 'マテリアルを作成', description: 'カード化の前の素材（ワードリスト等）をまとめて用意します。' },
  { href: '/items/new', icon: <GalleryHorizontal size={20} />, label: 'カードを作成', description: '単語や概念をAI画像のカードにします。' },
  { href: '/boxes/new', icon: <Box size={20} />, label: 'ボックスを作成', description: 'カードをテーマごとにまとめます。' },
  { href: '/views/new', icon: <LayoutGrid size={20} />, label: 'キャンバスを作成', description: 'カードを自由に配置するキャンバスを作ります。' },
  { href: '/spaces/new', icon: <Frame size={20} />, label: 'スペースを作成', description: '記憶の場所（ルーム／ロード）を作ります。' },
]

export default function AtelierPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold">アトリエ</h1>
      <p className="mt-2 text-muted-foreground">作りたいものを選んでください。</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CREATE_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            aria-label={action.label}
            className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
          >
            <Card className="h-full cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span style={{ color: 'var(--palace)' }}>{action.icon}</span>
                    {action.label}
                  </span>
                  <ChevronRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                    style={{ color: 'var(--palace)' }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
