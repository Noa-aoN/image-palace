'use client'

import { AdminGrantsPanel } from '@/components/features/admin/AdminGrantsPanel'
import { AdminOpsCreditsPanel } from '@/components/features/admin/AdminOpsCreditsPanel'
import { AdminPlansPanel } from '@/components/features/admin/AdminPlansPanel'

// 配るもの（クレジット・アイテム）の設定をまとめたページ
export default function AdminGrantsPage() {
  return (
    <div className="space-y-8">
      {/* 運営自身の残高。**配る設定より先に置く。**
          いちばん頻繁に見るのは「いま自分がどれだけ使ったか」なので */}
      <AdminOpsCreditsPanel />
      <AdminPlansPanel />
      <AdminGrantsPanel />
    </div>
  )
}
