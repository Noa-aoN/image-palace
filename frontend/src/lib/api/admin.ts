import { apiClient } from './client'
import type {
  AdminAuditLog,
  AdminOverview,
  AdminRole,
  AdminSession,
  AdminUser,
  AdminUsersPage,
} from '@/types/admin'

// いま入っている人の運営権限。一般ユーザーが呼んでもエラーにはならない
export async function getAdminSession(): Promise<AdminSession> {
  const res = await apiClient.get<AdminSession>('/api/v1/admin/session')
  return res.data
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await apiClient.get<AdminOverview>('/api/v1/admin/overview')
  return res.data
}

export async function getAdminUsers(params: {
  q?: string
  role?: string
  page?: number
}): Promise<AdminUsersPage> {
  const res = await apiClient.get<AdminUsersPage>('/api/v1/admin/users', { params })
  return res.data
}

// 役割の変更（運営の管理者のみ）。譲渡もこれで行う
export async function updateAdminUserRole(id: string, role: AdminRole): Promise<AdminUser> {
  const res = await apiClient.patch<AdminUser>(`/api/v1/admin/users/${id}/role`, { role })
  return res.data
}

export async function getAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const res = await apiClient.get<{ logs: AdminAuditLog[] }>('/api/v1/admin/audit_logs')
  return res.data.logs
}
