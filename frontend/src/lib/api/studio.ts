import { apiClient } from '@/lib/api/client'
import type { ContentPackageCounts } from '@/lib/api/contentPackages'

/** 荷物の扱い。**止めるのと終えるのを分ける** */
export type PackageStatus = 'draft' | 'published' | 'suspended' | 'archived'

/** 届け先。**どこで配るか**（種別とは別） */
export type Delivery = {
  channel: 'demo' | 'delphi' | 'campaign' | 'mission' | 'purchase'
  label: string
  note: string
  enabled: boolean
  /** 受け取る側の仕組みがまだ無い */
  pending: boolean
}

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
  /** どこへ届けるか */
  deliveries: Delivery[]
  /** いま実際に配られている版。この行の版とずれることがある（下書きを起こした直後など） */
  delivering_version: number | null
  /** 何人が受け取ったか（下見は数えない） */
  installs: number
  /** 前の版。**一覧は鍵ごとに1行**なので、古いものはここに畳む */
  history: PackageHistory[]
}

/** 前の版。もう押せることは無いので、記録として見せるだけ */
export type PackageHistory = {
  id: string
  version: number
  status: PackageStatus
  published_at: string | null
  installs: number
}

/**
 * 公式宮殿の1枚。**何が出ていて、何が出ていないか**を見るための形。
 *
 * 出すかどうかは箱とキャンバスの選択から導けるので、
 * こちらが持つのは「出さない」と決めた例外だけ
 */
export type StudioItem = {
  id: string
  title: string
  item_type: string | null
  thumb_url: string | null
  /** 入っている箱 */
  boxes: string[]
  /** 置かれているキャンバス */
  views: string[]
  /** すでに入って出ている荷物の鍵 */
  packages: string[]
  /** 出さないと決めた */
  excluded: boolean
  /** 出せない理由（絵・意味・種別の欠け）。**下書きを起こす前に分かるように** */
  blockers: string[]
}

/** 原本の箱。**選んだときに何が起きるかを、選ぶ前に出す** */
export type StudioBox = {
  id: string
  name: string
  items: number
  /** 「出さない」にしているカードの枚数（選ぶと、その分だけ落ちる） */
  excluded: number
  /** 絵・意味・種別が欠けているカードの枚数（選ぶと下書きが止まる） */
  blocked: number
}

/** 原本のキャンバス。**構造なので、1枚欠けると止まる** */
export type StudioView = {
  id: string
  name: string
  view_type: string
  items: number
  edges: number
  /** 宮殿に結びついていると、まだ配れない */
  portable: boolean
  /** 置かれているのに「出さない」にしているカード。あると下書きが止まる */
  blocking: string[]
}

/** 原本の宮殿。**まだ配れない** */
export type StudioSpace = {
  id: string
  name: string
  points: number
  portable: boolean
}

export type StudioItems = {
  items: StudioItem[]
  boxes: StudioBox[]
  views: StudioView[]
  spaces: StudioSpace[]
  /** 出さないと決めた枚数 */
  excluded: number
  /** 上限で切ったか */
  truncated: boolean
}

/**
 * いま見ている下見。
 *
 * 下見は自分のアカウントに入るので、**見た目は本物と変わらない**。
 * 何を見ているのかが分からなくなるので、いつでも引ける形にしてある
 */
export type PreviewState =
  | { active: false }
  | {
      active: true
      key: string
      version: number
      name: string | null
      /** 下書きの下見か、出しているものの下見か。**色ではなく文字で言うため** */
      status: PackageStatus | null
      box_id: string | null
      view_id: string | null
      items: number
      expires_at: string
      /** 原本が作り直されている＝いま見ているものは古い */
      stale: boolean
    }

export type StudioOwner = {
  email: string
  boxes: number
  views: number
  items: number
}

/** 運営クレジット。**今月あといくら自分の残高へ入れられるか**（使うのは普通の残高から） */
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
/** さっと見るときに返ってくる中身。**何も作らずに、荷物をそのまま読む** */
export type QuickLook = {
  key: string
  version: number
  name: string
  summary: string | null
  status: PackageStatus
  counts: ContentPackageCounts
  boxes: { name: string; description: string | null; count: number; total: number }[]
  views: { name: string; view_type: string; items: number; edges: number }[]
  items: {
    local_key: string
    title: string
    item_type: string | null
    image_url: string | null
    meaning: string | null
    tags: string[]
  }[]
}

export async function fetchQuickLook(key: string, version: number): Promise<QuickLook> {
  const res = await apiClient.get<QuickLook>(`/api/v1/admin/studio/${key}/${version}/quick_look`)
  return res.data
}

export async function fetchCurrentPreview(): Promise<PreviewState> {
  const res = await apiClient.get<PreviewState>('/api/v1/admin/studio/preview')
  return res.data
}

/** 下見を終える。**荷物を問わず、いま入っている下見を片付ける** */
export async function endPreview(): Promise<void> {
  await apiClient.delete('/api/v1/admin/studio/preview')
}

export async function fetchStudioItems(): Promise<StudioItems> {
  const res = await apiClient.get<StudioItems>('/api/v1/admin/studio/items')
  return res.data
}

/** 1枚だけ、出す・出さないを切り替える。**効くのは次に起こす下書きから** */
export async function setItemExclusion(id: string, excluded: boolean, note?: string) {
  const res = await apiClient.patch<{ id: string; excluded: boolean }>(
    `/api/v1/admin/studio/items/${id}/exclusion`,
    { excluded, note }
  )
  return res.data
}

export async function createDraft(input: DraftInput): Promise<StudioPackage> {
  const res = await apiClient.post<{ package: StudioPackage }>('/api/v1/admin/studio/draft', input)
  return res.data.package
}

/** 下見。自分の宮殿へ入れて、受け取った人と同じ画面で見る */
export async function previewPackage(key: string, version: number): Promise<PreviewState> {
  const res = await apiClient.post<PreviewState>(`/api/v1/admin/studio/${key}/${version}/preview`)
  return res.data
}

/** 届け先を入れ替える。**版ではなく鍵に付く**ので、出し直しても引き継がれる */
export async function setDelivery(
  key: string,
  channel: Delivery['channel'],
  enabled: boolean
): Promise<Delivery[]> {
  const res = await apiClient.patch<{ deliveries: Delivery[] }>(
    `/api/v1/admin/studio/${key}/delivery`,
    { channel, enabled }
  )
  return res.data.deliveries
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
  demo_package: {
    published: boolean
    packages?: { key: string; name: string; version: number; items: number }[]
    items?: number
  }
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
