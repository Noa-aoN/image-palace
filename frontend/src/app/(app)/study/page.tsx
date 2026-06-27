import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'スタディ' }

export default function StudyPage() {
  return (
    <PlaceholderPage
      title="スタディ"
      description="作成したカードで学習・想起トレーニングを行うページです。"
    />
  )
}
