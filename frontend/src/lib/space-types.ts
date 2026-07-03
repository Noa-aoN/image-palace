// スペース種別。room（棚＝ボックス）/ road（連結法＝序数ポイント）。
// バックエンドの Space::SPACE_TYPES と一致させること。
export const SPACE_TYPES = ['room', 'road'] as const

export type SpaceType = (typeof SPACE_TYPES)[number]

export const SPACE_TYPE_LABELS: Record<string, string> = {
  room: 'ルーム',
  road: 'ロード',
}

export function spaceTypeLabel(type: string): string {
  return SPACE_TYPE_LABELS[type] ?? type
}
