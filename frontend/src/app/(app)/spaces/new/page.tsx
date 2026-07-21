import type { Metadata } from 'next'
import { Frame } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateSpaceForm } from '@/components/features/spaces/CreateSpaceForm'

export const metadata: Metadata = { title: 'スペースを作成' }

export default function NewSpacePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Breadcrumb items={[{ href: '/spaces', label: 'スペース' }, { label: '作成' }]} />
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Frame size={26} style={{ color: 'var(--palace)' }} />
          スペースを作成
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          記憶の場所（ルーム／ロード）を作成します。
        </p>
      </div>
      <CreateSpaceForm redirectBase="/spaces" />
    </div>
  )
}
