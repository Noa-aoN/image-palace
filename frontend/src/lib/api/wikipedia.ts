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
  | { found: true; summary: WikipediaValue; disambiguation: boolean }
  | { found: false; message: string }

export async function fetchWikipediaSummary(term: string): Promise<WikipediaLookup> {
  const res = await apiClient.get<WikipediaLookup>('/api/v1/wikipedia/summary', { params: { q: term } })
  return res.data
}
