import { AuthGuard } from '@/components/features/auth/AuthGuard'
import { Sidebar } from '@/components/features/layout/Sidebar'
import { RightPanel } from '@/components/features/panel/RightPanel'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
      {/* 右パネルはオーバーレイ（絶対配置）。main を押し縮めない。 */}
      <RightPanel />
    </div>
  )
}
