import { HubBackground } from '@/components/features/layout/HubBackground'
import { SignedInSidebar } from '@/components/features/layout/SignedInSidebar'
import { LandingFooter } from '@/components/features/layout/LandingFooter'

/**
 * ログイン無しで読めるページの殻。
 *
 * `(app)` の殻とは分けてある。あちらは AuthGuard がログインへ送り、
 * PageGate は段階が読めるまで何も描かないので、**サーバーが返す HTML が空になる**。
 * 検索や SNS から来た人・クローラには、それでは何も届かない。
 *
 * ここでは門を通さない。本文はサーバー側でそのまま描かれる。
 * 脇の並びだけは、ログインしている人に限って後から出す。
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    // isolate: -z-10 の背景レイヤーをこの中に閉じ込める
    <div className="relative isolate flex flex-1 overflow-hidden">
      <HubBackground />
      <SignedInSidebar />
      {/* 検索から来た人は、ここが最初のページになる。
          規約・特商法・他の読みものへ辿れる足場を必ず置く */}
      <main className="flex-1 overflow-y-auto">
        {children}
        <LandingFooter />
      </main>
    </div>
  )
}
