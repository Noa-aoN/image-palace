import { AuthGuard } from '@/components/features/auth/AuthGuard'
import { Sidebar } from '@/components/features/layout/Sidebar'
import { RightPanel } from '@/components/features/panel/RightPanel'
import { HubBackground } from '@/components/features/layout/HubBackground'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // isolate: -z-10 の背景レイヤーをこの中に閉じ込める（本文・サイドバーはその上に描画）
    <div className="relative isolate flex flex-1 overflow-hidden">
      {/* route 連動のメインエリア背景（ハブページのみ）。非スクロール外側に置き全面固定。 */}
      <HubBackground />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
      {/* 右パネルはオーバーレイ（絶対配置）。main を押し縮めない。 */}
      <RightPanel />
    </div>
  )
}
