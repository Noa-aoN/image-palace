/**
 * 獲得物・実績・ミッションを、種別ごとに束ねる。
 *
 * 1枚の表に全部並べると、称号と勲章と褒賞が混ざる。運営から見ると
 * 「称号をひとつ足す」「勲章の公開を止める」のように**種別ごとの作業**なので、
 * 見出しで区切って束ねる。
 *
 * 束ねる順番は決め打ちにする。件数順や名前順にすると、行を1つ足しただけで
 * 群の並びが入れ替わり、毎回どこを見ればよいか探し直すことになる。
 */

/** 獲得物の種別。並びは「名乗るもの → 掲げるもの → 持ちもの → 贈られるもの」 */
export const REWARD_KIND_ORDER = ['title', 'medal', 'treasure', 'honor'] as const

export const REWARD_KIND_LABELS: Record<string, string> = {
  title: '称号',
  medal: '勲章',
  treasure: '褒賞',
  honor: '表彰',
}

/** ミッションの区切り。短いものから長いものへ */
export const MISSION_CADENCE_ORDER = ['onboarding', 'daily', 'weekly', 'monthly', 'event'] as const

export const MISSION_CADENCE_LABELS: Record<string, string> = {
  onboarding: 'はじめの一歩',
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
  event: '期間限定',
}

export type Group<T> = { key: string; label: string; rows: T[] }

/**
 * 決めた順で束ねる。空の群は出さない（見出しだけが並ぶと、
 * 何も無いのか読み込めていないのか分からない）。
 *
 * 決めた順に無い値は末尾へ回す。登録簿に新しい種別が増えても、
 * ここを直すまでのあいだ行が消えないようにする（消えると気づけない）。
 */
export function groupByOrder<T>(
  rows: T[],
  keyOf: (row: T) => string,
  order: readonly string[],
  labels: Record<string, string>
): Group<T>[] {
  const buckets = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row) || 'other'
    const list = buckets.get(key)
    if (list) list.push(row)
    else buckets.set(key, [row])
  }

  const known = order.filter((key) => buckets.has(key))
  const unknown = [...buckets.keys()].filter((key) => !order.includes(key)).sort()

  return [...known, ...unknown].map((key) => ({
    key,
    label: labels[key] ?? key,
    rows: buckets.get(key) ?? [],
  }))
}

/**
 * 実績の分類。category は自由入力で、未設定のものがある。
 * 未設定を落とすと画面から消えるので、「その他」に集めて必ず出す。
 */
export function groupAchievements<T extends { category?: string | null }>(rows: T[]): Group<T>[] {
  const categories = [...new Set(rows.map((r) => r.category || 'その他'))].sort((a, b) => {
    // 「その他」は最後。分類のあるものを先に読ませる
    if (a === 'その他') return 1
    if (b === 'その他') return -1
    return a.localeCompare(b, 'ja')
  })

  return categories.map((category) => ({
    key: category,
    label: category,
    rows: rows.filter((r) => (r.category || 'その他') === category),
  }))
}
