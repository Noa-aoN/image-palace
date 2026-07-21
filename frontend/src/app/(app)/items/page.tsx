import type { Metadata } from 'next'
import Link from 'next/link'
import { GalleryHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <GalleryHorizontal size={22} style={{ color: 'var(--palace)' }} />
          カード一覧
        </h1>
        <Link href="/items/new">
          <Button size="sm">+ カードを作成</Button>
        </Link>
      </div>
      <ItemList initialTag={tag ?? null} />
    </div>
  )
}
