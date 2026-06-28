// キャンバス種別。freeboard / space_map / deck が実装済み、他は仮置き（詳細は「準備中」表示）。
// バックエンドの View::VIEW_TYPES と一致させること。
export const VIEW_TYPES = ['freeboard', 'space_map', 'deck', 'page', 'map', 'timeline', 'binder', 'album'] as const

export type ViewType = (typeof VIEW_TYPES)[number]

export const VIEW_TYPE_LABELS: Record<string, string> = {
  freeboard: 'フリーボード',
  space_map: 'スペース配置',
  deck: 'デッキ',
  page: 'ページ',
  map: 'マップ',
  timeline: 'タイムライン',
  binder: 'バインダー',
  album: 'アルバム',
}

// 実装済みの種別（これ以外は詳細画面で「準備中」表示）
export const IMPLEMENTED_VIEW_TYPES = new Set<string>(['freeboard', 'space_map', 'deck'])

export function viewTypeLabel(type: string): string {
  return VIEW_TYPE_LABELS[type] ?? type
}
