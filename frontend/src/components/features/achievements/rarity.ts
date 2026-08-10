import type { RarityTier } from '@/lib/api/achievements'

/**
 * レア度の見せ方。
 *
 * 内部は9段階（石・青銅・大理石・銀・金・瑠璃・星・神聖・ムーサ）だが、
 * 画面では**5つに丸めて**出す。9段階をそのまま並べても、見る側は違いを覚えられず、
 * ただ細かいだけになる。
 *
 * 光らせるのは上の2段だけ。全部が光っていると、どれが特別なのか分からない。
 */
export interface RarityStyle {
  /** 枠と下地 */
  frame: string
  /** 淡い光彩。低い段には付けない */
  glow?: string
  /** 段の名前を出すときの色 */
  text: string
}

export const RARITY_STYLES: Record<RarityTier, RarityStyle> = {
  stone: {
    frame: 'border-border',
    text: 'text-muted-foreground',
  },
  metal: {
    frame: 'border-[#c9b27a]',
    text: 'text-[#8a7440]',
  },
  jewel: {
    frame: 'border-[#7c8fc4]',
    glow: '0 0 0 1px rgba(124,143,196,0.25), 0 2px 12px rgba(124,143,196,0.18)',
    text: 'text-[#5a6ba3]',
  },
  sacred: {
    frame: 'border-[#d8c27a]',
    glow: '0 0 0 1px rgba(216,194,122,0.35), 0 2px 16px rgba(216,194,122,0.28)',
    text: 'text-[#a58a34]',
  },
  muse: {
    frame: 'border-[#c9a7d8]',
    glow: '0 0 0 1px rgba(201,167,216,0.4), 0 3px 20px rgba(201,167,216,0.32)',
    text: 'text-[#8b5fa8]',
  },
}

export function rarityStyle(tier: RarityTier | undefined): RarityStyle {
  return RARITY_STYLES[tier ?? 'stone'] ?? RARITY_STYLES.stone
}

/**
 * レア度を印の数で表す。
 *
 * 段の名前（石・青銅・…・ムーサ）だけだと、どちらが上なのかを覚えないと分からない。
 * **印の数**なら、並べた瞬間に多いほうが上だと伝わる。
 *
 * 例外を作らず「印＝段の数」で通す。9段目だけ別の形にする、といった規則を足すと、
 * 見る側は毎回それを思い出す必要が出てくる。色だけを段ごとに変える。
 */
export const MAX_RARITY_LEVEL = 9
