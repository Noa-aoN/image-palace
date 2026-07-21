import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GalleryHorizontal } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateItemForm } from '@/components/features/items/CreateItemForm'

export const metadata: Metadata = { title: 'カードを作成' }

export default function NewItemPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-2xl">
        <div className="mb-8">
          <Breadcrumb items={[{ href: '/items', label: 'カード' }, { label: '作成' }]} />
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <GalleryHorizontal size={26} style={{ color: 'var(--palace)' }} />
            カードを作成
          </h1>
          <p className="mt-2 text-muted-foreground">
            単語や概念を入力すると、AIが画像を生成します
          </p>
        </div>
        <Suspense fallback={null}>
          <CreateItemForm />
        </Suspense>
      </div>
    </div>
  )
}
