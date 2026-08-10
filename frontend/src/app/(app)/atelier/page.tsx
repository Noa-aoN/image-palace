import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Boxes, GalleryHorizontal, Box, LayoutGrid, Frame, Palette } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CreateIcon } from '@/components/features/layout/CreateIcon'

export const metadata: Metadata = { title: 'アトリエ' }

// アトリエは「これから作る」ために来る場所なので、どれも専用ページへ送る。
//
// カードだけは右パネルで開いていたが、他の4つと押し心地が違ううえ、
// 作りに来た人をその場に留めることになっていた。作る気で来た人には広い場所を渡す。
// 一覧のツールバーやサイドバーからの「カードを作成」は、いま見ているものを
// 離れたくない場面なので、これまでどおり右パネルのままにしている。
const CREATE_ACTIONS: {
  href: string
  icon: ReactNode
  label: string
  description: string
}[] = [
  { href: '/materials/new', icon: <CreateIcon><Boxes size={20} /></CreateIcon>, label: 'マテリアルを作成', description: 'カード化の前の素材（ワードリスト等）をまとめて用意します。' },
  { href: '/items/new', icon: <CreateIcon><GalleryHorizontal size={20} /></CreateIcon>, label: 'カードを作成', description: '単語や概念をAI画像のカードにします。' },
  { href: '/views/new', icon: <CreateIcon><LayoutGrid size={20} /></CreateIcon>, label: 'キャンバスを作成', description: 'カードを自由に配置するキャンバスを作ります。' },
  { href: '/spaces/new', icon: <CreateIcon><Frame size={20} /></CreateIcon>, label: 'スペースを作成', description: '記憶の場所（ルーム／ロード）を作ります。' },
  { href: '/boxes/new', icon: <CreateIcon><Box size={20} /></CreateIcon>, label: 'ボックスを作成', description: 'カードをテーマごとにまとめます。' },
]

export default function AtelierPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <Palette size={26} style={{ color: 'var(--palace)' }} />
        アトリエ
      </h1>
      <p className="mt-2 text-muted-foreground">作りたいものを選んでください。</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CREATE_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            aria-label={action.label}
            className="group block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
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
