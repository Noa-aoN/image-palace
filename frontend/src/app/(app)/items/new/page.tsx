import Link from 'next/link'
import { CreateItemForm } from '@/components/features/items/CreateItemForm'

export default function NewItemPage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← ダッシュボード
        </Link>
        <h1 className="text-xl font-semibold">単語カードを作成</h1>
      </div>
      <CreateItemForm />
    </div>
  )
}
