import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ItemList } from '@/components/features/items/ItemList'

export const metadata: Metadata = { title: 'マイカード' }

export default function ItemsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">マイカード</h1>
        <Link href="/items/new">
          <Button size="sm">+ カードを作成</Button>
        </Link>
      </div>
      <ItemList />
    </div>
  )
}
