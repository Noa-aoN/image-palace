import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/contact'

export function LandingFooter() {
  return (
    <footer
      className="py-4 text-center text-xs text-muted-foreground"
      style={{ borderTop: '1px solid var(--palace)' }}
    >
      {/* 「使い方」「コラム」「お知らせ」はここに置かない。
          フッターは規約・問い合わせなど**読み終えたあとの行き先**の場所で、
          読みものへの入口は本文側（CTA・空の一覧・案内）から入ってもらう。
          並べると、規約と同じ重みの細字に埋もれて結局押されない。
          ページ自体は残っているので、/guide・/blog・/news は生きている */}
      <p>
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
