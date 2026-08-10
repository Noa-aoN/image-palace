import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, ListChecks, Images, Boxes } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { FeatureGate } from '@/components/features/shared/FeatureGate'
import { CreateIcon } from '@/components/features/layout/CreateIcon'

export const metadata: Metadata = { title: 'マテリアルを作成' }

type MaterialAction = {
  href?: string
  icon: ReactNode
  label: string
  description: string
  /** 運営が見せ方を決める機能。段階は管理画面（/admin/features）で切り替える */
  feature?: string
}

const MATERIAL_ACTIONS: MaterialAction[] = [
  {
    href: '/wordlists/new',
    icon: <CreateIcon><ListChecks size={20} /></CreateIcon>,
    label: 'ワードリストを作成',
    description: '単語・用語・概念をまとめた素材。カード生成やボックスの元データにします。',
  },
  {
    icon: <Images size={20} />,
    label: 'ピクチャーリストを作成',
    description: '画像素材をまとめた素材リスト。アップロード・生成済み・公開素材を扱えるようにする予定です。',
    feature: 'material_picture_list',
  },
]

export default function NewMaterialPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <Boxes size={26} style={{ color: 'var(--palace)' }} />
        マテリアルを作成
      </h1>
      <p className="mt-2 text-muted-foreground">
        マテリアルは、カード化・制作の前段になる素材です。作りたい素材を選んでください。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {MATERIAL_ACTIONS.map((action) =>
          action.feature ? (
            // 見せ方を運営が決める機能。段階は /admin/features で切り替える
            <FeatureGate
              key={action.label}
              feature={action.feature}
              title={action.label}
              description={action.description}
            >
              <MaterialActionCard action={action} />
            </FeatureGate>
          ) : (
            <MaterialActionCard key={action.label} action={action} />
          )
        )}
      </div>
      </div>
    </div>
  )
}

// 行き先があればリンク、無ければ触れない札として出す
function MaterialActionCard({ action }: { action: MaterialAction }) {
  if (!action.href) {
    return (
      <Card className="h-full border-dashed bg-card/60" aria-disabled>
        <CardContent>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span style={{ color: 'var(--palace)' }}>{action.icon}</span>
            {action.label}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Link
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
  )
}
