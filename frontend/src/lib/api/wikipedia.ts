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

/**
 * 題が一致しなかったときの候補。
 *
 * **選ぶのは利用者。** ここで返るのは候補だけで、保存はしない。
 * 1件を選んだあと、その題で改めて `fetchWikipediaSummary` を呼んで保存する。
 * 一番上を勝手に採ると、同名の別人・別作品が黙ってカードに入る。
 */
export type WikipediaCandidate = {
  title: string
  /** 一行の肩書き。題だけでは同名の別物を見分けられないので、これが本体 */
  description?: string
  thumbnail_url?: string
}

export type WikipediaSearch = {
  candidates: WikipediaCandidate[]
  language_code: string
  /** どれも語をかすっていない。候補は出すが、言い直しを勧める */
  weak: boolean
  message: string | null
}

export async function searchWikipediaCandidates(
  term: string,
  languageCode?: string
): Promise<WikipediaSearch> {
  const res = await apiClient.get<WikipediaSearch>('/api/v1/wikipedia/search', {
    params: { q: term, ...(languageCode ? { language_code: languageCode } : {}) },
  })
  return res.data
}

/**
 * 曖昧さ回避ページに並んでいる記事。
 *
 * 「アポロン」「水星」のような多義語を引くと、Wikipedia は行き先の一覧
 * （曖昧さ回避ページ）を返す。冒頭を保存しても意味が取れないので、
 * **一覧をそのまま次の選択肢として出す**。
 *
 * これが無かった頃は、候補に出た曖昧さ回避ページを選ぶと
 * 「その記事は引けませんでした」で行き止まりになっていた。
 */
export type WikipediaEntries = {
  candidates: WikipediaCandidate[]
  language_code: string
  message: string | null
}

export async function fetchWikipediaEntries(
  title: string,
  languageCode?: string
): Promise<WikipediaEntries> {
  const res = await apiClient.get<WikipediaEntries>('/api/v1/wikipedia/entries', {
    params: { title, ...(languageCode ? { language_code: languageCode } : {}) },
  })
  return res.data
}
