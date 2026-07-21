import type { Metadata } from 'next'
import { Store } from 'lucide-react'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'アゴラ' }

export default function AgoraPage() {
  return (
    <PlaceholderPage
      icon={<Store size={26} style={{ color: 'var(--palace)' }} />}
      title="アゴラ"
      description="コンテンツを共有・販売できるマーケットプレイスです。"
    />
  )
}
