import Link from 'next/link'

// アプリ全体の 404 ページ。存在しない URL へのアクセス時に表示する。
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">ページが見つかりません</h1>
      <p className="text-sm text-muted-foreground">
        お探しのページは移動または削除された可能性があります。
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
      >
        ホームに戻る
      </Link>
    </div>
  )
}
