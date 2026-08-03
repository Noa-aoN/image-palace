import type { Metadata } from 'next'
import { GalleryHorizontal } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { CreateItemForm } from '@/components/features/items/CreateItemForm'

export const metadata: Metadata = { title: 'カードを作成' }

/**
 * ワードリストからの持ち込みはクエリ（?wordlist=）で受ける。
 * 読み取りはここで済ませ、フォームには値だけを渡す。
 * フォーム側でクエリを読むと、フォームを使う画面すべてが
 * その都合（Suspense や動的描画）を背負うことになるため。
 */
export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ wordlist?: string }>
}) {
  const { wordlist } = await searchParams

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Breadcrumb items={[{ href: '/items', label: 'カード' }, { label: '作成' }]} />
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <GalleryHorizontal size={26} style={{ color: 'var(--palace)' }} />
            カードを作成
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            単語や概念を入力すると、AIが画像を生成します
          </p>
        </div>
        <CreateItemForm wordlistId={wordlist} />
      </div>
    </div>
  )
}
