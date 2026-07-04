import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateBoxForm } from '@/components/features/boxes/CreateBoxForm'

export const metadata: Metadata = { title: 'ボックスを作成' }

export default function NewBoxPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/boxes">
          <Button variant="ghost" className="text-sm px-0 mb-4">← ボックスへ戻る</Button>
        </Link>
        <h1 className="text-2xl font-semibold">ボックスを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          カードをテーマごとにまとめるボックスを作成します。
        </p>
      </div>
      <CreateBoxForm redirectBase="/boxes" />
    </div>
  )
}
