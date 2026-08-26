'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useConsentStore } from '@/stores/consent'

const STATUS_LABEL: Record<string, string> = {
  unset: '未選択',
  accepted: '同意済み',
  rejected: '拒否',
}

export default function CookieSettingsPage() {
  const consent = useConsentStore((s) => s.consent)
  const hasHydrated = useConsentStore((s) => s.hasHydrated)
  const accept = useConsentStore((s) => s.accept)
  const reject = useConsentStore((s) => s.reject)

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-3" style={{ color: 'var(--ink-strong)' }}>
          Cookie 設定
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--ink-body)' }}>
          本サイトでは、サービス改善のためのアクセス解析に Cookie を使用することがあります。
          以下から同意状態をいつでも変更できます。詳細は
          <Link href="/privacy" className="mx-1 underline hover:no-underline" style={{ color: 'var(--palace)' }}>
            プライバシーポリシー
          </Link>
          をご覧ください。
        </p>

        <div className="rounded-xl border border-border/70 bg-muted/40 px-5 py-4">
          <p className="text-sm">
            現在の状態:{' '}
            <span className="font-semibold">
              {hasHydrated ? (STATUS_LABEL[consent] ?? consent) : '読み込み中...'}
            </span>
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            onClick={accept}
            disabled={!hasHydrated}
            style={{ backgroundColor: 'var(--palace)', color: 'var(--on-accent)', border: 'none' }}
          >
            解析 Cookie に同意する
          </Button>
          <Button variant="outline" onClick={reject} disabled={!hasHydrated}>
            同意しない（拒否）
          </Button>
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
