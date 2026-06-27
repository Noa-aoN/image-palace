import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: 'ワードリストを作成' }

export default function NewWordlistPage() {
  return (
    <PlaceholderPage
      title="ワードリストを作成"
      description="学習したい単語のリストをまとめて作成するページです。"
    />
  )
}
