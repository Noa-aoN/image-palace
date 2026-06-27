import type { Metadata } from 'next'
import { DashboardContent } from '@/components/features/dashboard/DashboardContent'

export const metadata: Metadata = { title: 'エントランス' }

export default function EntrancePage() {
  return <DashboardContent />
}
