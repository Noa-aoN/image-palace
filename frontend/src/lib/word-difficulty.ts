/**
 * 単語生成の難しさ。
 *
 * バックエンドの GenerateWordsService::DIFFICULTIES と一致させること。
 * 同じ水準の語ばかりが出ると使い道が狭まるので、学ぶ人の段階に合わせて振れ幅を変える。
 */
export const WORD_DIFFICULTIES = ['easy', 'normal', 'hard', 'expert'] as const

export type WordDifficulty = (typeof WORD_DIFFICULTIES)[number]

export const WORD_DIFFICULTY_LABELS: Record<WordDifficulty, string> = {
  easy: '易しい',
  normal: 'ふつう',
  hard: '難しい',
  expert: 'とても難しい',
}

export const WORD_DIFFICULTY_DESCRIPTIONS: Record<WordDifficulty, string> = {
  easy: '身近で目に見えるもの',
  normal: '一般教養の範囲',
  hard: '分野の専門用語まで',
  expert: '学んだ人でなければ知らない語',
}

export const DEFAULT_WORD_DIFFICULTY: WordDifficulty = 'normal'

/** 知らない値は既定へ丸める（設定が古いときでも壊れないように） */
export function normalizeWordDifficulty(value: string | undefined | null): WordDifficulty {
  return (WORD_DIFFICULTIES as readonly string[]).includes(value ?? '')
    ? (value as WordDifficulty)
    : DEFAULT_WORD_DIFFICULTY
}
