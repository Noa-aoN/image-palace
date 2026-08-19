import { apiClient } from '@/lib/api/client'

export type ContentPackageCounts = {
  items: number
  boxes: number
  views: number
  tags: number
}

export type ContentPackageSummary = {
  key: string
  version: number
  name: string
  summary: string | null
  cover_image_key: string | null
  counts: ContentPackageCounts
  /** もう受け取っているか */
  received: boolean
}

export type ContentPackageList = {
  packages: ContentPackageSummary[]
  /** あと何個、無料で受け取れるか */
  free_remaining: number
}

export type InstallResult = {
  box_id: string | null
  view_id: string | null
  created: number
  reused: number
  package: ContentPackageSummary
}

export async function fetchContentPackages(): Promise<ContentPackageList> {
  const res = await apiClient.get<ContentPackageList>('/api/v1/content_packages')
  return res.data
}

export async function installContentPackage(key: string): Promise<InstallResult> {
  const res = await apiClient.post<InstallResult>(`/api/v1/content_packages/${key}/install`)
  return res.data
}
