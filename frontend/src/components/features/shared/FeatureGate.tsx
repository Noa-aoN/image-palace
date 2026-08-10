'use client'

import type { ReactNode } from 'react'
import { FlaskConical } from 'lucide-react'
import { useFeatureStage } from '@/stores/features'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'

/**
 * 作りかけの機能を、運営が決めた段階で出す。
 *
 * これまでは画面ごとに comingSoon をベタ書きしていたため、開発中の表示を外すのに
 * デプロイが要り、戻すのにもデプロイが要った。段階はサーバーが持ち、ここが従う。
 *
 * 読み込み中は何も出さない。ここで中身を先に出すと、hidden のはずの入口が
 * 一瞬だけ見えてしまう（見せたくないから hidden にしているので、それでは意味がない）。
 */
export function FeatureGate({
  feature,
  title,
  description,
  children,
}: {
  feature: string
  /** development のときに出す見出し */
  title?: string
  /** development のときに出す説明 */
  description?: string
  children: ReactNode
}) {
  const stage = useFeatureStage(feature)

  if (stage === undefined || stage === 'hidden') return null
  if (stage === 'development') return <ComingSoon title={title} description={description} />

  if (stage === 'prototype') {
    return (
      <div className="space-y-2">
        <PrototypeBadge />
        {children}
      </div>
    )
  }

  return <>{children}</>
}

/**
 * 触れるが粗い、と伝える印。
 *
 * 黙って出すと「壊れている」と受け取られ、準備中にすると触ってもらえない。
 * その間を作るための印なので、消さずに済むよう小さくしている。
 */
export function PrototypeBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <FlaskConical size={12} />
      プロトタイプ版
    </span>
  )
}
