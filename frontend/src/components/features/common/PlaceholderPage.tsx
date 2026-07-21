import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  description?: string
  icon?: ReactNode
}

/**
 * 未実装ページ共通の「準備中」プレースホルダ。
 * サイドバー再編で先に導線だけ用意したページに使う。
 */
export function PlaceholderPage({ title, description, icon }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        {icon}
        {title}
      </h1>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}

      {/* 背景演出に映える全幅パネル（半透明＋blur で下地の背景を活かす） */}
      <div className="mt-8 rounded-2xl border border-border/70 bg-card/70 px-6 py-28 text-center backdrop-blur-sm">
        <p className="text-base font-semibold" style={{ color: 'var(--palace)' }}>準備中</p>
        <p className="mt-2 text-sm text-muted-foreground">この機能は近日公開予定です。</p>
      </div>

      <div className="mt-8">
        <Link href="/entrance">
          <Button variant="outline">エントランスへ戻る</Button>
        </Link>
      </div>
    </div>
  )
}
