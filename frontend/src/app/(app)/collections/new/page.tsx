import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateCollectionForm } from '@/components/features/collections/CreateCollectionForm'

export const metadata: Metadata = { title: 'コレクションを作成' }

export default function NewCollectionPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/collections">
          <Button variant="ghost" className="text-sm px-0 mb-4">← コレクションへ戻る</Button>
        </Link>
        <h1 className="text-2xl font-semibold">コレクションを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          カードをテーマごとにまとめるコレクションを作成します。
        </p>
      </div>
      <CreateCollectionForm redirectBase="/collections" />
    </div>
  )
}
