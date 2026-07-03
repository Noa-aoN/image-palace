import { Spinner } from '@/components/ui/spinner'

// App Router のルート単位ローディング。ページ遷移・Suspense 中に表示する。
// 意匠は AuthGuard の読み込み表示に合わせる。
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
      <Spinner size={20} className="text-muted-foreground" label="読み込み中" />
      <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
    </div>
  )
}
