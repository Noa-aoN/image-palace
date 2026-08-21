'use client'

import { ListChecks } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateWordlistFlow } from '@/components/features/wordlists/CreateWordlistFlow'
import { bodyFor } from '@/lib/page-help'

export default function NewWordlistPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Breadcrumb items={[{ href: '/wordlists', label: 'ワードリスト' }, { label: '作成' }]} />
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <ListChecks size={26} style={{ color: 'var(--palace)' }} />
            ワードリストを作成
          </h1>
          <p className="mt-2 text-muted-foreground">{bodyFor('/wordlists/new')}</p>
        </div>
        <CreateWordlistFlow />
      </div>
    </div>
  )
}
