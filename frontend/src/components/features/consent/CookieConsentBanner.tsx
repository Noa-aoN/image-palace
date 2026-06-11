'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useConsentStore } from '@/stores/consent'

/**
 * 初回訪問時に表示する Cookie 同意バナー。
 * 選択は localStorage に保存され、選択済みなら表示しない（同意撤回は /cookie-settings から）。
 */
export function CookieConsentBanner() {
  const consent = useConsentStore((s) => s.consent)
  const hasHydrated = useConsentStore((s) => s.hasHydrated)
  const accept = useConsentStore((s) => s.accept)
  const reject = useConsentStore((s) => s.reject)

  // 復元前 / 選択済みは出さない（ちらつき・再表示防止）
  if (!hasHydrated || consent !== 'unset') return null

  return (
    <div
      role="dialog"
      aria-label="Cookie の利用について"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl bg-card px-5 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between"
        style={{ border: '1px solid var(--palace)' }}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          本サイトでは、サービス改善のためのアクセス解析に Cookie を使用することがあります。
          詳細は
          <Link href="/privacy" className="mx-1 underline hover:no-underline" style={{ color: 'var(--palace)' }}>
            プライバシーポリシー
          </Link>
          をご覧ください。
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={reject}>
            拒否する
          </Button>
          <Button
            size="sm"
            onClick={accept}
            style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}
          >
            同意する
          </Button>
        </div>
      </div>
    </div>
  )
}
