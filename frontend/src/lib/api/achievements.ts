import { apiClient } from './client'

/** メダルの段階。下から 銅 → 銀 → 金 */
export type Medal = 'bronze' | 'silver' | 'gold'

export interface AchievementCategory {
  key: string
  label: string
  description: string
  unit: string
  value: number
  /** まだ何も届いていなければ null */
  medal: Medal | null
  medal_label: string | null
  thresholds: number[]
  /** 次に届く段階。金まで行ったら null（永遠に終わらないように見せない） */
  next_at: number | null
  remaining: number | null
}

export interface AchievementTitle {
  key: string
  label: string
  gold_required: number
  earned: boolean
}

export interface Achievements {
  categories: AchievementCategory[]
  medals: Record<Medal, number>
  titles: AchievementTitle[]
  current_title: AchievementTitle | null
}

export async function getAchievements(): Promise<Achievements> {
  const res = await apiClient.get<Achievements>('/api/v1/achievements')
  return res.data
}
