import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateSpaceForm } from '@/components/features/spaces/CreateSpaceForm'

export const metadata: Metadata = { title: 'スペースを作成' }

export default function NewSpacePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/spaces">
          <Button variant="ghost" className="text-sm px-0 mb-4">← スペースへ戻る</Button>
        </Link>
        <h1 className="text-2xl font-semibold">スペースを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          記憶の場所（ルーム／ロード）を作成します。
        </p>
      </div>
      <CreateSpaceForm redirectBase="/spaces" />
    </div>
  )
}
