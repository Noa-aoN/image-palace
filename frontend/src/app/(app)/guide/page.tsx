import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: '使い方' }

export default function GuidePage() {
  return (
    <PlaceholderPage
      title="使い方"
      description="ImagePalace の使い方やチュートリアルを掲載するページです。"
    />
  )
}
