'use client'

import { AdminGrantsPanel } from '@/components/features/admin/AdminGrantsPanel'
import { AdminPlansPanel } from '@/components/features/admin/AdminPlansPanel'

// 配るもの（クレジット・アイテム）の設定をまとめたページ
export default function AdminGrantsPage() {
  return (
    <div className="space-y-8">
      <AdminPlansPanel />
      <AdminGrantsPanel />
    </div>
  )
}
