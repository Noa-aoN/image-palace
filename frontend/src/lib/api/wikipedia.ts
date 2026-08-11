import { apiClient } from './client'
import type { WikipediaValue } from './properties'

/**
 * Wikipedia の要約を引く。**必ず Rails を経由する。**
 *
 * ブラウザから直接叩かないのは、Wikimedia が求める User-Agent をブラウザが
 * 上書きしてしまうため、こちらでキャッシュできないため、そして許可する
 * 外部ホスト（CSP の connect-src）を増やさないため。
 *
 * 引けなくても 200 で返る（found: false）。Wikipedia が落ちていることは
 * こちらの不具合ではないので、画面を壊さずに伝える。
 */
export type WikipediaLookup =
  | { found: true; summary: WikipediaValue; language_code: string; disambiguation: boolean }
  | { found: false; language_code: string; message: string }

/**
 * languageCode を渡さなければ、サーバーが
 * 「利用者の表示言語 → ブラウザの言語 → ja」の順に決める。
 * いまは画面に選択を出していないが、渡せる形にはしておく。
 */
export async function fetchWikipediaSummary(term: string, languageCode?: string): Promise<WikipediaLookup> {
  const res = await apiClient.get<WikipediaLookup>('/api/v1/wikipedia/summary', {
    params: { q: term, ...(languageCode ? { language_code: languageCode } : {}) },
  })
  return res.data
}
