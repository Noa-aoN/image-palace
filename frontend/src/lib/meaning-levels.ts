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

/**
 * 意味・説明に付ける言語。
 *
 * 同じ単語でも、訳や語釈は言語ごとに要る（英単語に日本語の語釈と英英の定義を
 * 両方持たせたい、など）。器（meanings.language_code）は前からあるので、選べるようにする。
 */
export const MEANING_LANGUAGES = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: '英語' },
  { code: 'zh', label: '中国語' },
  { code: 'ko', label: '韓国語' },
  { code: 'fr', label: 'フランス語' },
  { code: 'de', label: 'ドイツ語' },
  { code: 'es', label: 'スペイン語' },
] as const

export const DEFAULT_MEANING_LANGUAGE = 'ja'

export function meaningLanguageLabel(code: string): string {
  return MEANING_LANGUAGES.find((l) => l.code === code)?.label ?? code
}
