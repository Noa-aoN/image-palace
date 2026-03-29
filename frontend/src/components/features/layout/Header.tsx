import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header
      className="border-b px-6 py-4 flex items-center justify-between"
      style={{ backgroundColor: 'var(--ivory)', borderColor: '#E3E6EA' }}
    >
      <Link href="/" className="text-xl font-semibold tracking-wide">
        ImagePalace
      </Link>
      <nav className="flex items-center gap-3">
        <Link href="/login">
          <Button
            variant="ghost"
            className="text-sm"
          >
            ログイン
          </Button>
        </Link>
        <Link href="/signup">
          <Button
            variant="outline"
            className="text-sm"
            style={{ borderColor: 'var(--palace)', color: 'var(--palace)' }}
          >
            はじめる
          </Button>
        </Link>
      </nav>
    </header>
  )
}
