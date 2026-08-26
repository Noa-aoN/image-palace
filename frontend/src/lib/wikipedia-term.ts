/**
 * Wikipedia を引く語。
 *
 * **見出し語で固定しない。**
 * 見出し語は短い呼び名で置くことが多く（DNS・国連・東大）、
 * それをそのまま引くと目的の記事に当たらないことがある。
 * 逆に、見出し語が一般名詞すぎて曖昧さ回避のページに落ちることもある。
 *
 * 何で引くかを決められれば、どちらも人が直せる。
 */

/** 引く語の長さの上限。Wikipedia の題は 255 バイトまでなので、それより手前で止める */
export const MAX_TERM_LENGTH = 120

/**
 * 実際に引く語を決める。
 *
 * **空欄は「見出し語のまま」。** 何も書いていない状態を「語が無い」と
 * 扱うと、消しただけで引けなくなる。書いていなければ元の語で引く。
 */
export function resolveLookupTerm(draft: string, fallback: string): string {
  const trimmed = draft.trim()
  return trimmed === '' ? fallback.trim() : trimmed
}

/** 引ける語か。空（見出し語も空）と長すぎるものは断る */
export function canLookup(draft: string, fallback: string): boolean {
  const term = resolveLookupTerm(draft, fallback)
  return term !== '' && term.length <= MAX_TERM_LENGTH
}
