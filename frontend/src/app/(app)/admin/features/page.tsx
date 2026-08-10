'use client'

import { AdminFeaturesPanel } from '@/components/features/admin/AdminFeaturesPanel'

// 作りかけの機能を、どこまで見せるかを決めるページ
export default function AdminFeaturesPage() {
  return (
    <div className="space-y-8">
      <AdminFeaturesPanel />
    </div>
  )
}
