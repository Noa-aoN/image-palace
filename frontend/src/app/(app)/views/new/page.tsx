import type { Metadata } from 'next'
import { LayoutGrid } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateViewForm } from '@/components/features/views/CreateViewForm'

export const metadata: Metadata = { title: 'キャンバスを作成' }

export default function NewViewPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Breadcrumb items={[{ href: '/views', label: 'キャンバス' }, { label: '作成' }]} />
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <LayoutGrid size={26} style={{ color: 'var(--palace)' }} />
            キャンバスを作成
          </h1>
          <p className="mt-2 text-muted-foreground">
            カードを配置するキャンバス（フリーボード／スペース配置）を作成します。
          </p>
        </div>
        <CreateViewForm redirectBase="/views" />
      </div>
    </div>
  )
}
