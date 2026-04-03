import type { Metadata } from 'next'
import { DashboardContent } from '@/components/features/dashboard/DashboardContent'

export const metadata: Metadata = { title: 'ダッシュボード' }

export default function DashboardPage() {
  return <DashboardContent />
}
