import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/features/common/PlaceholderPage'

export const metadata: Metadata = { title: '横断検索' }

export default function SearchPage() {
  return (
    <PlaceholderPage
      title="横断検索"
      description="カード・コレクション・ビュー・スペースを横断して検索するページです。"
    />
  )
}
