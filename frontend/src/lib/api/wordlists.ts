import { apiClient } from './client'
import type { Wordlist } from '@/types/wordlist'

interface GenerateWordsOptions {
  // 絶対に出さない語（既出＝受け取り済み）。
  exclude?: string[]
  // 出る確率を大きく下げる語（キャンセル済み）。
  avoid?: string[]
  // 語彙の難しさ（未指定なら利用者の設定に従う）
  difficulty?: string
}

// テーマ/ジャンルから単語を生成する（テキストのみ・クレジット消費なし）。
// count を省略すると「おまかせ（自動）」: テーマに応じた数（有限集合は過不足なく）をAIが返す。
// ワードリスト作成フォームとデルフォイ（ガチャ）で共有する。
export async function generateWords(theme: string, count?: number, opts?: GenerateWordsOptions): Promise<string[]> {
  const payload: Record<string, unknown> = { theme }
  if (count != null) payload.count = count
  if (opts?.exclude?.length) payload.exclude = opts.exclude
  if (opts?.avoid?.length) payload.avoid = opts.avoid
  if (opts?.difficulty) payload.difficulty = opts.difficulty
  const res = await apiClient.post<{ words: string[] }>('/api/v1/words/generate', payload)
  return res.data.words
}

// AIチェックの判定。バックエンドの CheckWordsService::VERDICTS と対応する（ok は返らない）。
export type WordVerdict = 'off_theme' | 'duplicate' | 'inappropriate' | 'typo'

export type WordCheckIssue = {
  word: string
  verdict: WordVerdict
  reason: string
  // 置き換え案。無ければ null（＝削除を検討する）
  replacement: string | null
}

export type WordCheckResult = {
  issues: WordCheckIssue[]
  // テーマに対して欠けている単語の追加提案
  additions: string[]
}

// 単語リストがテーマに沿っているかを AI で点検する（テキストのみ・クレジット消費なし）。
// 提案の適用は呼び出し側でユーザーが承認する。
export async function checkWords(theme: string, words: string[]): Promise<WordCheckResult> {
  const res = await apiClient.post<WordCheckResult>('/api/v1/words/check', { theme, words })
  return res.data
}

export async function getWordlists(limit?: number): Promise<Wordlist[]> {
  const res = await apiClient.get<Wordlist[]>('/api/v1/wordlists', {
    params: limit ? { limit } : undefined,
  })
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

// リスト名・単語（並び順を含む）を更新する。words は配列の順序がそのまま保存される。
export async function updateWordlist(
  id: string,
  payload: { name?: string; words?: string[] }
): Promise<Wordlist> {
  const res = await apiClient.patch<Wordlist>(`/api/v1/wordlists/${id}`, { wordlist: payload })
  return res.data
}

export async function deleteWordlist(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/wordlists/${id}`)
}
