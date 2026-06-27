import Link from 'next/link'

export function AuthFooter() {
  return (
    <footer
      className="py-4 text-center text-xs text-muted-foreground"
      style={{ borderTop: '1px solid var(--palace)' }}
    >
      <p>
        <Link href="/terms" className="hover:underline">利用規約</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/tokushoho" className="hover:underline">特定商取引法に基づく表記</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/cookie-settings" className="hover:underline">Cookie設定</Link>
        <span className="mx-2" aria-hidden>|</span>
        <span>お問い合わせ</span>
      </p>
      <p className="mt-1">© 2026 ImagePalace</p>
    </footer>
  )
}
