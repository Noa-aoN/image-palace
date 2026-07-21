import type { Metadata } from 'next'
import { Swords } from 'lucide-react'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'スタディオン' }

export default function StadionPage() {
  return (
    <PlaceholderPage
      icon={<Swords size={26} style={{ color: 'var(--palace)' }} />}
      title="スタディオン"
      description="ゲーム形式の学習コンテンツで競い合えるページです。"
    />
  )
}
