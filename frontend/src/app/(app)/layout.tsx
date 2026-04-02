import { AuthGuard } from '@/components/features/auth/AuthGuard'
import { Sidebar } from '@/components/features/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  )
}
