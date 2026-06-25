// 説明（意味）の詳しさレベル。バックエンドの Meaning::DETAIL_LEVELS と一致させること。
export const MEANING_LEVELS = ['brief', 'simple', 'detailed'] as const

export type MeaningLevel = (typeof MEANING_LEVELS)[number]

export const MEANING_LEVEL_LABELS: Record<string, string> = {
  brief: 'ひとこと',
  simple: 'シンプル',
  detailed: 'くわしく',
}

export const DEFAULT_MEANING_LEVEL: MeaningLevel = 'simple'

export function meaningLevelLabel(level: string): string {
  return MEANING_LEVEL_LABELS[level] ?? level
}
