import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'アゴラ' }

export default function AgoraPage() {
  return (
    <PlaceholderPage
      title="アゴラ"
      description="コンテンツを共有・販売できるマーケットプレイスです。"
    />
  )
}
