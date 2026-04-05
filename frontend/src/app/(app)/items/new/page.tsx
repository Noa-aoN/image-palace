import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateItemForm } from '@/components/features/items/CreateItemForm'

export const metadata: Metadata = { title: 'カードを作成' }

export default function NewItemPage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/items">
          <Button variant="ghost" className="text-sm px-0 mb-4">← マイカードへ戻る</Button>
        </Link>
        <h1 className="text-2xl font-semibold">カードを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          単語や概念を入力すると、AIが画像を生成します
        </p>
      </div>
      <CreateItemForm />
    </div>
  )
}
