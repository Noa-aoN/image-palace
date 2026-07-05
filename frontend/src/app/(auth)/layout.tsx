import { AuthFooter } from '@/components/features/layout/AuthFooter'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex items-center justify-center py-6 px-4">
        {children}
      </main>
      <AuthFooter />
    </div>
  )
}
