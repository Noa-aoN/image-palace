import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  description?: string
}

/**
 * 未実装ページ共通の「準備中」プレースホルダ。
 * サイドバー再編で先に導線だけ用意したページに使う。
 */
export function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}

      <div className="mt-8 rounded-xl border border-border/70 bg-muted/40 px-6 py-16 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--palace)' }}>準備中</p>
        <p className="mt-1 text-sm text-muted-foreground">この機能は近日公開予定です。</p>
      </div>

      <div className="mt-8">
        <Link href="/entrance">
          <Button variant="outline">エントランスへ戻る</Button>
        </Link>
      </div>
    </div>
  )
}
