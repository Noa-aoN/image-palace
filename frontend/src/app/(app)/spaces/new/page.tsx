import type { Metadata } from 'next'
import { Frame } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateSpaceForm } from '@/components/features/spaces/CreateSpaceForm'
import { bodyFor } from '@/lib/page-help'

export const metadata: Metadata = { title: 'スペースを作成' }

export default function NewSpacePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Breadcrumb items={[{ href: '/spaces', label: 'スペース' }, { label: '作成' }]} />
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <Frame size={26} style={{ color: 'var(--palace)' }} />
            スペースを作成
          </h1>
          <p className="mt-2 text-muted-foreground">{bodyFor('/spaces/new')}</p>
        </div>
        <CreateSpaceForm redirectBase="/spaces" />
      </div>
    </div>
  )
}
