import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, ListChecks, Images } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'マテリアル一覧' }

type MaterialKind = {
  href?: string
  icon: ReactNode
  label: string
  description: string
  comingSoon?: boolean
}

const MATERIAL_KINDS: MaterialKind[] = [
  {
    href: '/wordlists',
    icon: <ListChecks size={20} />,
    label: 'ワードリスト',
    description: '単語・用語・概念をまとめた素材。カード生成やボックスの元データになります。',
  },
  {
    icon: <Images size={20} />,
    label: 'ピクチャーリスト',
    description: '画像素材をまとめた素材リスト。アップロード・生成済み・公開素材を扱えるようにする予定です。',
    comingSoon: true,
  },
]

export default function MaterialsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold">マテリアル一覧</h1>
      <p className="mt-2 text-muted-foreground">
        マテリアルは、カード化・制作の前段になる素材です。種類ごとに管理できます。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {MATERIAL_KINDS.map((kind) =>
          kind.comingSoon || !kind.href ? (
            <Card key={kind.label} className="h-full border-dashed bg-card/60" aria-disabled>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span style={{ color: 'var(--palace)' }}>{kind.icon}</span>
                    {kind.label}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">準備中</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{kind.description}</p>
              </CardContent>
            </Card>
          ) : (
            <Link
              key={kind.label}
              href={kind.href}
              aria-label={kind.label}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
            >
              <Card className="h-full cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span style={{ color: 'var(--palace)' }}>{kind.icon}</span>
                      {kind.label}
                    </span>
                    <ChevronRight
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--palace)' }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{kind.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        )}
      </div>
    </div>
  )
}
