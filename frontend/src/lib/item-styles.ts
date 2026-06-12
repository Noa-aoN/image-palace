// 画像生成スタイルのプリセット。value はバックエンド PromptBuilderService::STYLES と一致させること。
export interface StyleOption {
  value: string
  label: string
}

export const STYLE_OPTIONS: StyleOption[] = [
  { value: '', label: 'おまかせ' },
  { value: 'illustration', label: 'イラスト' },
  { value: 'photo', label: '写真' },
  { value: 'watercolor', label: '水彩' },
  { value: 'anime', label: 'アニメ' },
  { value: '3d', label: '3D' },
  { value: 'pixel', label: 'ドット絵' },
  { value: 'sketch', label: 'スケッチ' },
]

export const CUSTOM_PROMPT_MAX_LENGTH = 300
