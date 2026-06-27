import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'アリーナ' }

export default function ArenaPage() {
  return (
    <PlaceholderPage
      title="アリーナ"
      description="ゲーム形式の学習コンテンツで競い合えるページです。"
    />
  )
}
