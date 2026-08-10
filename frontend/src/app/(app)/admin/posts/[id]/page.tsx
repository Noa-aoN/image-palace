'use client'

import { useParams } from 'next/navigation'
import { AdminPostEditor } from '@/components/features/admin/AdminPostEditor'

export default function EditAdminPostPage() {
  const { id } = useParams<{ id: string }>()
  return <AdminPostEditor postId={id} />
}
