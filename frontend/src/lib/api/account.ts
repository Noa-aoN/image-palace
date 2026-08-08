import { apiClient } from './client'

// 自分の全データ（JSON）を取得する。ダウンロードは呼び出し側で行う。
export async function exportAccountData(): Promise<unknown> {
  const res = await apiClient.get('/api/v1/account/export')
  return res.data
}

// アカウントと関連データを完全に削除する。
export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/api/v1/account')
}

export interface Profile {
  name: string | null
  email: string
  /** 入居日（アカウントを開いた日） */
  created_at: string
  avatar_url: string | null
  avatar_thumb_url: string | null
  avatar_generation_status: string | null
  avatar_generation_error?: string | null
}

// 現在ユーザーのプロフィール（アバター URL・生成ステータス含む）。生成のポーリング先。
export async function getProfile(): Promise<Profile> {
  const res = await apiClient.get<Profile>('/api/v1/account/profile')
  return res.data
}

// 表示名を変更する。空文字を渡すと未設定へ戻る（画面側が既定名を出す）
export async function updateProfile(profile: { name: string }): Promise<Profile> {
  const res = await apiClient.patch<Profile>('/api/v1/account/profile', { profile })
  return res.data
}

// プロフィールアイコンの生成を開始（非同期・1cr 消費）。返る status は pending。
export async function generateAvatar(prompt: string, style?: string): Promise<Profile> {
  const res = await apiClient.post<Profile>('/api/v1/account/avatar', {
    avatar: { prompt, ...(style ? { style } : {}) },
  })
  return res.data
}

// プロフィールアイコンを削除する。
export async function deleteAvatar(): Promise<Profile> {
  const res = await apiClient.delete<Profile>('/api/v1/account/avatar')
  return res.data
}
