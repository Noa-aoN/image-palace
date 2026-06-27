import { apiClient } from './client'
import type { Wordlist } from '@/types/wordlist'

// テーマ/ジャンルから単語を生成する（テキストのみ・クレジット消費なし）。
// count を省略すると「おまかせ（自動）」: テーマに応じた数（有限集合は過不足なく）をAIが返す。
// ワードリスト作成フォームとデルフォイ（ガチャ）で共有する。
export async function generateWords(theme: string, count?: number): Promise<string[]> {
  const payload: Record<string, string | number> = { theme }
  if (count != null) payload.count = count
  const res = await apiClient.post<{ words: string[] }>('/api/v1/words/generate', payload)
  return res.data.words
}

export async function getWordlists(): Promise<Wordlist[]> {
  const res = await apiClient.get<Wordlist[]>('/api/v1/wordlists')
  return res.data
}

export async function getWordlist(id: string): Promise<Wordlist> {
  const res = await apiClient.get<Wordlist>(`/api/v1/wordlists/${id}`)
  return res.data
}

export async function createWordlist(name: string, words: string[]): Promise<Wordlist> {
  const res = await apiClient.post<Wordlist>('/api/v1/wordlists', { wordlist: { name, words } })
  return res.data
}

export async function deleteWordlist(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/wordlists/${id}`)
}
