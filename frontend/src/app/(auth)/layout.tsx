export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        {children}
      </main>
      <footer
        className="py-4 text-center text-xs text-muted-foreground"
        style={{ borderTop: '1px solid var(--palace)' }}
      >
        <p>
          <span>利用規約</span>
          <span className="mx-2" aria-hidden>|</span>
          <span>プライバシーポリシー</span>
          <span className="mx-2" aria-hidden>|</span>
          <span>お問い合わせ</span>
        </p>
        <p className="mt-1">© 2026 ImagePalace</p>
      </footer>
    </div>
  )
}
