import { apiClient } from './client'

/**
 * カードを確認した記録。
 *
 * 1問ずつ送らず、1回の学習ぶんをまとめて送る。20問のクイズで20回往復すると、
 * 通信のたびに詰まるし、途中で切れたとき何が残ったか分からない。
 *
 * 記録できなくても学習は続けさせる。結果画面が出せないほうが困るので、
 * 失敗は握りつぶす（次の学習でまた記録される）。
 */
export type ReviewResult = 'correct' | 'incorrect' | 'seen'
export type ReviewMode = 'practice' | 'quiz' | 'game'

export interface ReviewEntry {
  item_id: string
  result: ReviewResult
  mode: ReviewMode
}

export interface ReviewSummary {
  count: number
  last_reviewed_at: string | null
  recent_graded_count: number
  recent_correct_count: number
}

export async function recordReviews(reviews: ReviewEntry[]): Promise<number> {
  if (reviews.length === 0) return 0

  try {
    const res = await apiClient.post<{ recorded: number }>('/api/v1/item_reviews', { reviews })
    return res.data.recorded
  } catch {
    // 学習そのものは止めない
    return 0
  }
}

export async function getReviewSummary(itemId: string): Promise<ReviewSummary> {
  const res = await apiClient.get<ReviewSummary>(`/api/v1/items/${itemId}/reviews/summary`)
  return res.data
}
