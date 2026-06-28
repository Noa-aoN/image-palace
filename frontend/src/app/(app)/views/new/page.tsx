import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateViewForm } from '@/components/features/views/CreateViewForm'

export const metadata: Metadata = { title: 'キャンバスを作成' }

export default function NewViewPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/views">
          <Button variant="ghost" className="text-sm px-0 mb-4">← キャンバスへ戻る</Button>
        </Link>
        <h1 className="text-2xl font-semibold">キャンバスを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          カードを配置するキャンバス（フリーボード／スペース配置）を作成します。
        </p>
      </div>
      <CreateViewForm redirectBase="/views" />
    </div>
  )
}
