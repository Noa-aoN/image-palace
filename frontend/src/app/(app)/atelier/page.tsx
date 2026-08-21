import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Boxes, GalleryHorizontal, Box, LayoutGrid, Frame, Palette } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CreateIcon } from '@/components/features/layout/CreateIcon'
import { KindPreview } from '@/components/features/atelier/KindPreview'
import type { AtelierKind } from '@/lib/atelier/examples'
import { bodyFor } from '@/lib/page-help'

export const metadata: Metadata = { title: 'アトリエ' }

// アトリエは「これから作る」ために来る場所なので、どれも専用ページへ送る。
//
// カードだけは右パネルで開いていたが、他の4つと押し心地が違ううえ、
// 作りに来た人をその場に留めることになっていた。作る気で来た人には広い場所を渡す。
// 一覧のツールバーやサイドバーからの「カードを作成」は、いま見ているものを
// 離れたくない場面なので、これまでどおり右パネルのままにしている。
//
// 文字だけだと、作る前に結果を想像できない。**どれも、できあがりを添えて出す**。
type CreateAction = {
  href: string
  kind: AtelierKind
  icon: ReactNode
  label: string
  description: string
}

/**
 * 作れるものを、役割で3つに分ける。
 *
 * 5つを同じ大きさで並べていたころは、**どれから選べばよいかの手がかりが無かった**。
 * 初めての人はまずカードを作るのに、並びの2番目に埋もれていた。
 *
 * 見出しは「前工程・後工程」のような順番を含む言い方にしない。
 * 素材から作るのも、いきなりカードを作るのも、どちらも入口として正しい。
 * **それぞれが何をする場所か**だけを言う。
 */
const GROUPS: { title: string; actions: CreateAction[] }[] = [
  {
    title: 'カードをつくる',
    actions: [
      {
        href: '/items/new',
        kind: 'item',
        icon: <CreateIcon><GalleryHorizontal size={20} /></CreateIcon>,
        label: 'カード',
        description: '単語や概念を、AI画像つきのカードにします。',
      },
    ],
  },
  {
    title: '素材からつくる',
    actions: [
      {
        href: '/materials/new',
        kind: 'material',
        icon: <CreateIcon><Boxes size={20} /></CreateIcon>,
        label: 'マテリアル',
        description: 'カードを作るもとになる言葉や素材を、まとめて準備します。',
      },
    ],
  },
  {
    title: '整理・配置する',
    actions: [
      {
        href: '/views/new',
        kind: 'view',
        icon: <CreateIcon><LayoutGrid size={20} /></CreateIcon>,
        label: 'キャンバス',
        description: 'カードを自由に並べて、関係や流れを整理します。',
      },
      {
        href: '/spaces/new',
        kind: 'space',
        icon: <CreateIcon><Frame size={20} /></CreateIcon>,
        label: 'スペース',
        description: 'カードを場所やルート（ルーム／ロード）に配置して整理します。',
      },
      {
        href: '/boxes/new',
        kind: 'box',
        icon: <CreateIcon><Box size={20} /></CreateIcon>,
        label: 'ボックス',
        description: 'カードやスペース、キャンバスをまとめます。',
      },
    ],
  },
]

export default function AtelierPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <Palette size={26} style={{ color: 'var(--palace)' }} />
        アトリエ
      </h1>
      <p className="mt-2 text-muted-foreground">{bodyFor('/atelier')}</p>

      <div className="mt-8 space-y-8">
        {GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">{group.title}</h2>
            {/*
              カードとマテリアルは1件しかないので、3列の格子に置くと
              右に2枠ぶんの空白が残る。**件数に合わせて列を決める。**
              カードだけは広い枠に置いて、絵も横に大きく出す
            */}
            {/* 3枚の群は **md（768px）から3列**にする。
                lg（1024px）まで2列のままだと、タブレットでは3枚目だけが
                次の行へ落ちて、そのぶん（1行 268px）が丸ごと空く。
                3列にすると1行に収まり、無駄な行が消える */}
            <div
              className={
                group.actions.length === 1
                  ? 'grid gap-4'
                  : 'grid gap-4 sm:grid-cols-2 md:grid-cols-3'
              }
            >
              {group.actions.map((action) => (
                <CreateCard key={action.label} action={action} wide={group.actions.length === 1} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/**
 * 作れるもの1つぶんの札。
 *
 * `wide` のときは、狭い画面では縦に、広い画面では**絵を横へ**置く。
 * 縦に積むと、1件だけの群が他の3件ぶんの高さになって、画面が間延びする。
 */
function CreateCard({ action, wide }: { action: CreateAction; wide: boolean }) {
  return (
    <Link
      href={action.href}
      aria-label={`${action.label}を作成`}
      className="group block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
    >
      <Card className="h-full cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
        {/* **図は下端で揃える。** 説明が2行の札と3行の札が隣り合うと、
            図の位置がばらけて、並びが波打って見える。
            縦積みのときは高さいっぱいに伸ばし、説明と図の間で余りを吸わせる */}
        <CardContent
          className={wide ? 'sm:flex sm:items-center sm:gap-6' : 'flex h-full flex-col'}
        >
          <div className={wide ? 'sm:min-w-0 sm:flex-1' : undefined}>
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
          </div>
          {/* 絵は理解の助けなので小さくしすぎない。広い枠では横に置いて、
              札の高さを抑えたまま同じ大きさを保つ */}
          <div className={wide ? 'mt-3 sm:mt-0 sm:w-72 sm:shrink-0' : 'mt-auto pt-3'}>
            <KindPreview kind={action.kind} label={action.label} compact={wide} />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
