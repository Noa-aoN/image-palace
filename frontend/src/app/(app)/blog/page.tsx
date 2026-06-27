import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'コラム' }

export default function BlogPage() {
  return (
    <PlaceholderPage
      title="コラム"
      description="記憶・学習・認知科学にまつわるコラムを掲載するページです。"
    />
  )
}
