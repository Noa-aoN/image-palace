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
