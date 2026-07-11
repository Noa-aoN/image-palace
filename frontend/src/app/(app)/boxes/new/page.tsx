import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateBoxForm } from '@/components/features/boxes/CreateBoxForm'

export const metadata: Metadata = { title: 'ボックスを作成' }

export default function NewBoxPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Breadcrumb items={[{ href: '/boxes', label: 'ボックス' }, { label: '作成' }]} />
        <h1 className="text-2xl font-semibold">ボックスを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          カードをテーマごとにまとめるボックスを作成します。
        </p>
      </div>
      <CreateBoxForm redirectBase="/boxes" />
    </div>
  )
}
