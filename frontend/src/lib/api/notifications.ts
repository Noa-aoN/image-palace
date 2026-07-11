import { apiClient } from './client'

// お知らせの種別。バックエンドの Notification::KINDS と対応する。
export type NotificationKind = 'item_generation_completed' | 'item_generation_failed' | 'announcement'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  // クリック時の遷移先（相対パス）。無い場合もある
  url: string | null
  // 種別ごとの付随情報（item_id・まとめ件数 count など）
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}

export type NotificationsPage = {
  notifications: AppNotification[]
  unread_count: number
  meta: { page: number; per: number; total_count: number; total_pages: number }
}

export async function getNotifications(page = 1, per = 20): Promise<NotificationsPage> {
  const res = await apiClient.get<NotificationsPage>('/api/v1/notifications', { params: { page, per } })
  return res.data
}

// 未読バッジ用の軽量エンドポイント（定期的に叩く）
export async function getUnreadCount(): Promise<number> {
  const res = await apiClient.get<{ unread_count: number }>('/api/v1/notifications/unread_count')
  return res.data.unread_count
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await apiClient.post<AppNotification>(`/api/v1/notifications/${id}/read`)
  return res.data
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/api/v1/notifications/read_all')
}
