import Link from 'next/link'

type LegalLayoutProps = {
  title: string
  /** 「最終更新日: 2026-06-11」などの表示用文字列 */
  updatedAt: string
  children: React.ReactNode
}

/**
 * 利用規約・プライバシーポリシーなど、静的な法務ページ共通のレイアウト。
 * 未ログインでも閲覧可能なトップレベルページから利用する。
 */
export function LegalLayout({ title, updatedAt, children }: LegalLayoutProps) {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--ink-strong)' }}>
          {title}
        </h1>
        <p className="text-xs text-muted-foreground mb-10">{updatedAt}</p>

        <div className="legal-prose space-y-8 text-sm leading-relaxed" style={{ color: 'var(--ink-body)' }}>
          {children}
        </div>

        <div className="mt-14 pt-6 text-sm" style={{ borderTop: '1px solid var(--palace)' }}>
          <Link href="/" className="hover:underline" style={{ color: 'var(--palace)' }}>
            ← トップへ戻る
          </Link>
        </div>
      </main>
    </div>
  )
}

/** 章見出し（h2）。本文内で繰り返し使うため共通化する。 */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold" style={{ color: 'var(--ink-strong)' }}>
        {heading}
      </h2>
      {children}
    </section>
  )
}
