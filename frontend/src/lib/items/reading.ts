import type { ReadingValue } from '@/lib/api/properties'

/**
 * 言語ごとの読み方から、**いま主に出すもの**を選ぶ。
 *
 * 基本の言語（環境設定の `locale`）に合うものがあれば、それ。
 * 無ければ書いた順の先頭。
 *
 * **値は動かさない。** 基本の言語を変えても、並び替えたり移したりはしない。
 * 変わるのは「どれを主として出すか」だけ。
 * こうしておけば、言語を戻したときに元の見え方へそのまま戻る。
 */
export function primaryReading(
  value: ReadingValue | null | undefined,
  locale: string | null | undefined
): { language: string; text: string } | null {
  const rows = value ?? []
  if (rows.length === 0) return null

  const base = normalizeLanguage(locale)
  return rows.find((row) => normalizeLanguage(row.language) === base) ?? rows[0]
}

/** 主のもの以外。**主を2度出さない** */
export function otherReadings(
  value: ReadingValue | null | undefined,
  locale: string | null | undefined
): ReadingValue {
  const rows = value ?? []
  const primary = primaryReading(rows, locale)
  if (!primary) return []

  return rows.filter((row) => row !== primary)
}

/**
 * 言語の綴りを揃える。**サーバーと同じ決まり**にする。
 * 揃えないと `ja` と `JA` が別の言語になり、主が選べなくなる。
 */
export function normalizeLanguage(code: string | null | undefined): string {
  return (code ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

/**
 * 画面に出す言語の呼び名。
 *
 * **知らない綴りは、そのまま出す。** 学ぶ言語は人によって違い、
 * こちらが並べた一覧に無い言語を「不明」と出すのは失礼にあたる。
 */
const LANGUAGE_LABELS: Record<string, string> = {
  ja: '日本語',
  en: '英語',
  es: 'スペイン語',
  fr: 'フランス語',
  de: 'ドイツ語',
  it: 'イタリア語',
  pt: 'ポルトガル語',
  ru: 'ロシア語',
  zh: '中国語',
  ko: '韓国語',
  ar: 'アラビア語',
  la: 'ラテン語',
  grc: '古典ギリシア語',
}

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[normalizeLanguage(code)] ?? code
}
