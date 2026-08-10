'use client'

import { AdminPostsList } from '@/components/features/admin/AdminPostsList'

// 読みものの一覧。書くのは個別ページ（/admin/posts/new・/admin/posts/[id]）
export default function AdminPostsPage() {
  return <AdminPostsList />
}
