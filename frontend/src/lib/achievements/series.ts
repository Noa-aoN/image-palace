import type { AchievementRow } from '@/lib/api/achievements'

/**
 * 同じものを数える実績を、1本の道にまとめる。
 *
 * 実績は「1枚 → 10枚 → 20枚 → 50枚 … 10000枚」のように段で増える。
 * 1段ずつ並べると、カード作成だけで9行、全体では44行が縦に並び、
 * ページの半分が**まだ遠い未達成**で埋まる。
 *
 * まとめる手がかりは `condition_type`。名前や並び順から当てない
 * （「10枚のカード」と「10枚の見返し」は名前が似ているだけで別の道）。
 *
 * **進捗は段ごとに持たない。** 同じものを数えているので、どの段から見ても
 * 同じ値になる（実測で確認済み）。だから道としての現在地は1つに決まる。
 */
export interface AchievementSeries {
  /** 何を数えているか。並びの安定した鍵として使う */
  key: string
  /** 道の名前。**いちばん上の段の名前から作らない**（「10000枚のカード」になる） */
  name: string
  category: string | null
  /** 段（目標の小さい順） */
  steps: AchievementRow[]
  /** いまの数 */
  progress: number
  /** 達成した段の数 */
  doneCount: number
  /** 次に達成する段。全部済んでいれば null */
  next: AchievementRow | null
  /** 残り。次の段が無ければ null */
  remaining: number | null
  /** 段が1つだけの実績か（まとめる意味が無いので、そのまま出す） */
  single: boolean
}

/**
 * 道の名前。段の名前（「10枚のカード」）は数を含むので、そのままでは使えない。
 * **説明文から数の部分を落とす**（「カードを10枚作る」→「カードを作る」）。
 * 落としきれないものは、いちばん下の段の名前をそのまま使う。
 */
export function seriesName(steps: AchievementRow[]): string {
  const first = steps[0]
  const source = first.description ?? first.name

  const stripped = source
    // 「カードを10枚作る」「7日続ける」「100回正解する」など、数＋助数詞を落とす
    .replace(/\d[\d,]*\s*(枚|回|日|個|件|人|語|章|冊)?/g, '')
    .replace(/\s+/g, '')
    .trim()

  return stripped.length >= 2 ? stripped : first.name
}

/** 実績の並びを、道の並びに畳む。**元の順は保つ**（分類の並びが崩れない） */
export function buildSeries(rows: AchievementRow[]): AchievementSeries[] {
  const order: string[] = []
  const groups = new Map<string, AchievementRow[]>()

  for (const row of rows) {
    // 目印が無い実績（古い版のAPI）は、それ自身で1本の道として扱う
    const key = row.condition_type ?? `single:${row.key}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(row)
  }

  const seriesList = order.map((key) => {
    const steps = [...groups.get(key)!].sort((a, b) => a.condition_target - b.condition_target)
    const done = steps.filter((s) => s.completed_at)
    const next = steps.find((s) => !s.completed_at) ?? null

    return {
      key,
      name: steps.length > 1 ? seriesName(steps) : steps[0].name,
      category: steps[0].category,
      steps,
      // どの段から見ても同じ値。念のため最大を取る（段ごとに数え直された直後のずれを吸収）
      progress: Math.max(...steps.map((s) => s.progress)),
      doneCount: done.length,
      next,
      remaining: next ? Math.max(0, next.condition_target - Math.max(...steps.map((s) => s.progress))) : null,
      single: steps.length === 1,
    }
  })

  return seriesList
}

/**
 * 道を分類ごとに振り分ける。
 *
 * **道は分類をまたぐ。** 「カードを作る」は 1枚 が「はじめに」、
 * 10枚以降が「作成」に置かれている。分類ごとに畳むと道が2つに割れ、
 * 1枚を達成しているのに「0 / 8段」と出てしまう（実際に出ていた）。
 *
 * だから畳むのは全体で1度だけにして、置き場所はあとから決める。
 * 置き場所は**段がいちばん多い分類**（道の行き先）。
 * 同数なら先に出てきたほうを採る（並びが揺れないように）。
 */
export function seriesCategory(series: AchievementSeries): string | null {
  const counts = new Map<string, number>()
  for (const step of series.steps) {
    const key = step.category ?? 'その他'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }

  return best
}
