import { apiClient } from './client'

/** 獲得物の種類。称号は名乗るもの、勲章は掲げるもの、褒賞は飾るもの、表彰は選ばれたもの */
export type RewardKind = 'title' | 'medal' | 'treasure' | 'honor'
/** 画面で使う5つの段。内部のレア度（1〜9）をここへ丸めて出す */
export type RarityTier = 'stone' | 'metal' | 'jewel' | 'sacred' | 'muse'

export interface RewardPreview {
  type: 'reward' | 'credits'
  key?: string
  name?: string
  kind?: RewardKind
  kind_label?: string
  rarity_tier?: RarityTier
  image_url?: string | null
  amount?: number
}

export interface RewardRow {
  key: string
  kind: RewardKind
  kind_label: string
  name: string
  description: string | null
  /** 1〜9。印の数で出す。段の名前は画面に出さない（9つ覚えないと上下が分からない） */
  rarity_level: number
  /** 色を決める段（9段を5つに丸めたもの） */
  rarity_tier: RarityTier
  category: string | null
  /** 差し替え可能。無い間は種類ごとの絵柄で描く */
  image_url: string | null
  /** 未獲得のものに「どうすれば手に入るか」。無いものは手動付与（表彰など） */
  condition: string | null
  progress: number | null
  target: number | null
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

/** 称号をまだ持っていない人に出す「次の一歩」 */
export interface NextTitle {
  name: string
  image_url: string | null
  condition: string | null
  progress: number
  target: number
  remaining: number
}

export interface AchievementsPage {
  summary: {
    title: RewardRow | null
    next_title: NextTitle | null
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
  /** 実績の分類と、その並び順 */
  categories: string[]
  max_featured: number
}

export type AchievementSummary = AchievementsPage['summary']

/**
 * 装備中の称号と代表勲章だけ。エントランスなど、栄誉の間の外から呼ぶ。
 * 全体を読むと実績の数え直しまで走るので、軽いほうを使う。
 */
export async function getAchievementSummary(): Promise<AchievementSummary> {
  const res = await apiClient.get<AchievementSummary>('/api/v1/achievements/summary')
  return res.data
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
