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

// 種別を選んだときに出す短い説明。何ができるものかを 1 行で伝える
export const VIEW_TYPE_DESCRIPTIONS: Record<string, string> = {
  freeboard: 'カードを自由な位置に置ける板。関係を線でつないで整理できます。',
  space_map: 'ロードやルームにカードを配置し、場所と結びつけて覚えます。',
  deck: 'カードを一組にまとめ、めくりながら学習します。',
  page: '文章とカードを混ぜて 1 枚の記事として書き残します。',
  map: 'カードを地図上に置き、場所との関係で捉えます。',
  timeline: 'カードを時系列に並べ、前後関係で捉えます。',
  binder: 'カードを章立てで綴じ、資料としてまとめます。',
  album: 'カードを写真帳のように並べ、眺めて思い出します。',
}

export function viewTypeDescription(type: string): string | undefined {
  return VIEW_TYPE_DESCRIPTIONS[type]
}

// 実装済みの種別（これ以外は詳細画面で「準備中」表示）
export const IMPLEMENTED_VIEW_TYPES = new Set<string>(['freeboard', 'space_map', 'deck'])

export function viewTypeLabel(type: string): string {
  return VIEW_TYPE_LABELS[type] ?? type
}
