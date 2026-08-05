import type { Metadata } from 'next'
import { GalleryHorizontal } from 'lucide-react'
import { ItemList } from '@/components/features/items/ItemList'

export const metadata: Metadata = { title: 'カード' }

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const { tag } = await searchParams
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* 見出しは「ここが何の一覧か」だけ。作成・選択は一覧側の操作列にまとめている */}
      <h1 className="mb-6 flex items-center gap-2.5 text-2xl font-semibold">
        <GalleryHorizontal size={26} style={{ color: 'var(--palace)' }} />
        カード一覧
      </h1>
      <ItemList initialTag={tag ?? null} />
    </div>
  )
}
