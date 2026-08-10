'use client'

import { AdminAiModelsPanel } from '@/components/features/admin/AdminAiModelsPanel'

// AI モデルの登録簿（原価・消費クレジット・表示・用途・上限）
export default function AdminModelsPage() {
  return (
    <div className="space-y-8">
      <AdminAiModelsPanel />
    </div>
  )
}
