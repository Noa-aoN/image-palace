import type { Metadata } from 'next'
import { Box } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateBoxForm } from '@/components/features/boxes/CreateBoxForm'

export const metadata: Metadata = { title: 'ボックスを作成' }

export default function NewBoxPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Breadcrumb items={[{ href: '/boxes', label: 'ボックス' }, { label: '作成' }]} />
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <Box size={26} style={{ color: 'var(--palace)' }} />
            ボックスを作成
          </h1>
          <p className="mt-2 text-muted-foreground">
            カードやスペース、キャンバスをまとめるボックスを作成します。
          </p>
        </div>
        <CreateBoxForm redirectBase="/boxes" />
      </div>
    </div>
  )
}
