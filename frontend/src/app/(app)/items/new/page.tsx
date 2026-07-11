import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateItemForm } from '@/components/features/items/CreateItemForm'

export const metadata: Metadata = { title: 'カードを作成' }

export default function NewItemPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Breadcrumb items={[{ href: '/items', label: 'カード' }, { label: '作成' }]} />
        <h1 className="text-2xl font-semibold">カードを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          単語や概念を入力すると、AIが画像を生成します
        </p>
      </div>
      <Suspense fallback={null}>
        <CreateItemForm />
      </Suspense>
    </div>
  )
}
