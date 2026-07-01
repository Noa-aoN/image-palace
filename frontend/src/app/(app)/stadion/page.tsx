import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'スタディオン' }

export default function StadionPage() {
  return (
    <PlaceholderPage
      title="スタディオン"
      description="ゲーム形式の学習コンテンツで競い合えるページです。"
    />
  )
}
