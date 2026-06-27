import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'デルフォイ' }

export default function DelphiPage() {
  return (
    <PlaceholderPage
      title="デルフォイ"
      description="ランダムなワードからカードを錬成するページです。"
    />
  )
}
