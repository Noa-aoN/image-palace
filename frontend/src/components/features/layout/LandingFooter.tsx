import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/contact'

export function LandingFooter() {
  return (
    <footer
      className="py-4 text-center text-xs text-muted-foreground"
      style={{ borderTop: '1px solid var(--palace)' }}
    >
      {/* 読みものと使い方は、入る前に読める。**入口が無いと、書いても辿り着けない** */}
      <p>
        <Link href="/guide" className="hover:underline">使い方</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/blog" className="hover:underline">コラム</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/news" className="hover:underline">お知らせ</Link>
      </p>
      <p className="mt-1">
        <Link href="/terms" className="hover:underline">利用規約</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/privacy" className="hover:underline">プライバシーポリシー</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/tokushoho" className="hover:underline">特定商取引法に基づく表記</Link>
        <span className="mx-2" aria-hidden>|</span>
        <Link href="/cookie-settings" className="hover:underline">Cookie設定</Link>
        <span className="mx-2" aria-hidden>|</span>
        {/* 出どころは特商法ページと同じ1か所。設定すれば両方がリンクになる */}
        {CONTACT_EMAIL ? (
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">お問い合わせ</a>
        ) : (
          <span>お問い合わせ</span>
        )}
      </p>
      <p className="mt-2">© 2026 ImagePalace</p>
    </footer>
  )
}
