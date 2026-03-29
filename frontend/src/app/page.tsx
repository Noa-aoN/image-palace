import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function TopPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-4" style={{ color: '#111111' }}>
        単語をイメージに変えて、
        <br />
        記憶を設計する。
      </h1>
      <p className="text-lg max-w-md mb-10" style={{ color: '#4A4A4A' }}>
        AI が単語を画像に変換し、視覚的に記憶しやすいカード形式で管理・想起できます。
      </p>
      <Link href="/signup">
        <Button
          size="lg"
          className="px-8 text-base"
          style={{
            backgroundColor: 'var(--palace)',
            color: '#fff',
            border: 'none',
          }}
        >
          無料ではじめる
        </Button>
      </Link>
    </div>
  )
}
