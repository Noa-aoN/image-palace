'use client'

import { ListChecks } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateWordlistFlow } from '@/components/features/wordlists/CreateWordlistFlow'

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
          <p className="mt-2 text-muted-foreground">
            テーマを入れるとAIが単語を生成します。単語数はおまかせ（テーマに応じてAIが決める）が既定です。
            並び替え・編集して、AIチェックで内容を確かめてから保存できます。
          </p>
        </div>
        <CreateWordlistFlow />
      </div>
    </div>
  )
}
