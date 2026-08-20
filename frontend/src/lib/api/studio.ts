import { apiClient } from '@/lib/api/client'
import type { ContentPackageCounts } from '@/lib/api/contentPackages'

/** 荷物の扱い。**止めるのと終えるのを分ける** */
export type PackageStatus = 'draft' | 'published' | 'suspended' | 'archived'

export type StudioPackage = {
  id: string
  key: string
  version: number
  kind: 'demo' | 'starter' | 'advance'
  status: PackageStatus
  name: string
  summary: string | null
  counts: ContentPackageCounts
  published_at: string | null
  updated_at: string
  /** 何人が受け取ったか（下見は数えない） */
  installs: number
}

export type StudioOwner = {
  email: string
  boxes: number
  views: number
  items: number
}

/** 公式制作枠。**通常のクレジットとは別の勘定** */
export type StudioAllowance = {
  used_credits: number
  limit_credits: number
  remaining_credits: number
  period_start: string
}

export type StudioOverview = {
  owner: StudioOwner | null
  allowance: StudioAllowance | null
  packages: StudioPackage[]
}

export type StudioSourceBox = {
  id: string
  name: string
  description: string | null
  items: number
}

export type StudioSourceView = {
  id: string
  name: string
  view_type: string
  items: number
  edges: number
  /** 宮殿に結びついたキャンバスは、まだ運べない */
  portable: boolean
}

export type StudioSources = {
  boxes: StudioSourceBox[]
  views: StudioSourceView[]
}

export async function fetchStudio(): Promise<StudioOverview> {
  const res = await apiClient.get<StudioOverview>('/api/v1/admin/studio')
  return res.data
}

export async function fetchStudioSources(): Promise<StudioSources> {
  const res = await apiClient.get<StudioSources>('/api/v1/admin/studio/sources')
  return res.data
}

export type DraftInput = {
  key: string
  kind: 'demo' | 'starter' | 'advance'
  name: string
  summary?: string
  box_ids: string[]
  view_ids: string[]
}

/** 選んだものを下書きとして起こす。**ここで欠けが見つかれば、公開の前に止まる** */
export async function createDraft(input: DraftInput): Promise<StudioPackage> {
  const res = await apiClient.post<{ package: StudioPackage }>('/api/v1/admin/studio/draft', input)
  return res.data.package
}

export type PreviewResult = {
  box_id: string | null
  view_id: string | null
  items: number
}

/** 下見。自分の宮殿へ入れて、受け取った人と同じ画面で見る */
export async function previewPackage(key: string, version: number): Promise<PreviewResult> {
  const res = await apiClient.post<PreviewResult>(`/api/v1/admin/studio/${key}/${version}/preview`)
  return res.data
}

export async function discardPreview(key: string, version: number): Promise<void> {
  await apiClient.delete(`/api/v1/admin/studio/${key}/${version}/preview`)
}

export type StatusAction = 'publish' | 'suspend' | 'resume' | 'archive'

export async function changeStatus(
  key: string,
  version: number,
  action: StatusAction
): Promise<StudioPackage> {
  const res = await apiClient.patch<{ package: StudioPackage }>(
    `/api/v1/admin/studio/${key}/${version}/status`,
    { status_action: action }
  )
  return res.data.package
}

/** 工房の設定。**枠の上限と、体験の入口** */
export type StudioSettings = {
  official_account: { configured: boolean; email?: string; items?: number }
  allowance_limit_credits: number
  demo_entry_stage: string
  demo_entry_stages: string[]
  demo_package: { published: boolean; key?: string; version?: number; counts?: ContentPackageCounts }
}

export async function fetchStudioSettings(): Promise<StudioSettings> {
  const res = await apiClient.get<StudioSettings>('/api/v1/admin/studio/settings')
  return res.data
}

export async function updateStudioSettings(
  patch: { allowance_limit_credits?: number; demo_entry_stage?: string }
): Promise<StudioSettings> {
  const res = await apiClient.patch<StudioSettings>('/api/v1/admin/studio/settings', patch)
  return res.data
}
