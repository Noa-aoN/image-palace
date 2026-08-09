import { Clock, Loader2, AlertTriangle, type LucideIcon } from 'lucide-react'
import type { GenerationStatus } from '@/types/item'

// 生成ステータスの表示ラベル。カード一覧・詳細で共通利用する。
export const STATUS_LABEL: Record<GenerationStatus, string> = {
  pending: '生成待ち',
  processing: '生成中',
  completed: '完了',
  failed: '失敗',
}

// ステータスバッジの配色。
export const STATUS_COLOR: Record<GenerationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

// ステータスを表すアイコン。completed は画像で伝わるためアイコン無し（バッジ自体も出さない）。
export const STATUS_ICON: Record<GenerationStatus, LucideIcon | null> = {
  pending: Clock,
  processing: Loader2,
  completed: null,
  failed: AlertTriangle,
}

// 生成中（＝ポーリングを継続する）ステータス集合。
export const POLLING_STATUSES: ReadonlySet<GenerationStatus> = new Set<GenerationStatus>([
  'pending',
  'processing',
])

// まだ生成中（pending / processing）か。
export function isGenerating(status: GenerationStatus): boolean {
  return POLLING_STATUSES.has(status)
}

/**
 * 「作り直し中」か。生成中で、かつ**前の画像がまだ残っている**状態。
 *
 * 作り直しは古い画像を消さずに新しい生成を始める（差し替わるまで見られる方が親切なため）。
 * その結果、状態だけ見ると生成中なのに画面には完成した画像が出ていて、
 * 押したのに何も起きていないように見えていた。初回生成（画像が無い）とは
 * 見せ方を分ける必要があるので、両方を見て判定する。
 */
export function isRegenerating(status: GenerationStatus, hasImage: boolean): boolean {
  return hasImage && isGenerating(status)
}
