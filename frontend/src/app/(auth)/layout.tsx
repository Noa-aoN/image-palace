export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        {children}
      </main>
      <footer
        className="py-4 text-center text-xs text-muted-foreground"
        style={{ borderTop: '1px solid var(--palace)' }}
      >
        <p>© 2026 ImagePalace</p>
      </footer>
    </div>
  )
}
