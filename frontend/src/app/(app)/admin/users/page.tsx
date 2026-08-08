'use client'

import { useAdminStore } from '@/stores/admin'
import { AdminUsersPanel } from '@/components/features/admin/AdminUsersPanel'

// 役割の変更は運営の管理者だけ。判定はサーバー側でも行われる。
// 権限はヘッダーが既に読み込んだストアから借りる（同じ問い合わせを繰り返さない）
export default function AdminUsersPage() {
  const session = useAdminStore((s) => s.session)

  return <AdminUsersPanel canChangeRole={session?.owner ?? false} />
}
