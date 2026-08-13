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
 * 何を書いた文か。バックエンドの Meaning::KINDS と一致させること。
 *
 * 「意味」と一括りにすると、**短く覚えたい人にも長い解説が出る**。
 * 逆に、もとの意味だけ知りたいのに いまの意味しか無い、も起きる。
 * 詳しさ（ひとこと / シンプル / くわしく）とは別の軸なので、混ぜない。
 */
export const MEANING_KINDS = [
  { key: 'meaning', label: '意味', hint: 'その語が指すもの。いちばん短い' },
  { key: 'description', label: '説明', hint: 'かみ砕いた言い方' },
  { key: 'commentary', label: '解説', hint: '背景や周辺の話。長くなる' },
  { key: 'translation', label: '翻訳', hint: '他の言語での言い方' },
  { key: 'origin', label: '原義', hint: 'もとの意味。いまの意味とずれていることがある' },
] as const

export type MeaningKind = (typeof MEANING_KINDS)[number]['key']

export const DEFAULT_MEANING_KIND: MeaningKind = 'meaning'

export function meaningKindLabel(kind: string): string {
  return MEANING_KINDS.find((row) => row.key === kind)?.label ?? kind
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
