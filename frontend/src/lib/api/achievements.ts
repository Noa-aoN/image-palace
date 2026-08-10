import { apiClient } from './client'

/** 獲得物の種類。称号は名乗るもの、勲章は掲げるもの、褒賞は飾るもの、表彰は選ばれたもの */
export type RewardKind = 'title' | 'medal' | 'treasure' | 'honor'
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface RewardPreview {
  type: 'reward' | 'credits'
  key?: string
  name?: string
  kind?: RewardKind
  kind_label?: string
  image_url?: string | null
  amount?: number
}

export interface RewardRow {
  key: string
  kind: RewardKind
  kind_label: string
  name: string
  description: string | null
  rarity: Rarity
  category: string | null
  /** 差し替え可能。無い間は種類ごとの絵柄で描く */
  image_url: string | null
  owned: boolean
  granted_at: string | null
  equipped: boolean
  featured: boolean
  equippable: boolean
  featurable: boolean
  room_displayable: boolean
}

export interface UpcomingRow {
  key: string
  name: string
  description: string | null
  progress: number
  target: number
  remaining: number
  rewards: RewardPreview[]
}

export interface MissionRow {
  key: string
  name: string
  description: string | null
  cadence: string
  cadence_label: string
  progress: number
  target: number
  completed: boolean
  rewards: RewardPreview[]
}

export interface AchievementRow {
  key: string
  name: string
  description: string | null
  category: string | null
  condition_target: number
  progress: number
  completed_at: string | null
  rewards: RewardPreview[]
}

export interface StatRow {
  key: string
  label: string
  unit: string
  value: number
}

export interface AchievementsPage {
  summary: {
    title: RewardRow | null
    featured: RewardRow[]
    rewards_earned: number
    achievements_completed: number
    streak_days: number
  }
  upcoming: UpcomingRow[]
  missions: MissionRow[]
  rewards: RewardRow[]
  achievements: AchievementRow[]
  stats: StatRow[]
  max_featured: number
}

export async function getAchievements(): Promise<AchievementsPage> {
  const res = await apiClient.get<AchievementsPage>('/api/v1/achievements')
  return res.data
}

/** 称号を1つ装備する。key を空にすると外す */
export async function equipTitle(key: string): Promise<AchievementsPage> {
  const res = await apiClient.post<AchievementsPage>('/api/v1/achievements/equip', { key })
  return res.data
}

/** 代表勲章として掲げる／下ろす */
export async function toggleFeatured(key: string): Promise<AchievementsPage> {
  const res = await apiClient.post<AchievementsPage>('/api/v1/achievements/feature', { key })
  return res.data
}
