export function AuthFooter() {
  return (
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
  )
}
