/**
 * 体験中に触れない場所。
 *
 * **隠さない。灰色にして、押せなくする。**
 *
 * 消してしまうと「この宮殿にはそれが無い」と読まれる。
 * 体験は「本物がどういうものか」を見てもらう場なので、
 * **あることは見せて、いまは使えないことだけを伝える**ほうがよい。
 *
 * 使えないのは、アカウントに紐づくもの（設定・支払い・退会）と、
 * クレジットが要るもの（AI への相談）と、まだ無いもの（アゴラ・スタディオン）。
 */

/** その節ごと使えないもの */
const LOCKED_SECTIONS = new Set(['outside', 'ops'])

/** 節の中で、この入口から下が使えないもの */
const LOCKED_ROOTS = ['/myroom', '/settings', '/billing', '/account', '/achievements']

/** 節が使えなくても、ここだけは押せる。**体験中こそ役に立つ** */
const ALLOWED = ['/guide']

export function lockedForDemo({
  sectionKey,
  href,
}: {
  sectionKey: string
  href?: string
}): boolean {
  if (href && ALLOWED.includes(href)) return false
  if (LOCKED_SECTIONS.has(sectionKey)) return true
  if (!href) return false

  return LOCKED_ROOTS.some((root) => href === root || href.startsWith(`${root}/`))
}

/**
 * 体験中に閉じたものの見た目。
 *
 * **包みを増やさずに閉じる**ときに使う。grid の子の間に1枚挟むと
 * `items-stretch` が届かなくなり、隣の札と高さが揃わなくなる。
 *
 * 節そのものは押せるままにして（そうしないと理由を出せない）、
 * 中の行き先と釦だけを殺す。
 */
export const DEMO_DIM =
  'cursor-not-allowed opacity-40 [&_a]:pointer-events-none [&_button]:pointer-events-none'

/** 押せないことに添える一言。**なぜ使えないのかを言う** */
export const DEMO_LOCKED_HINT = '体験の宮殿では使えません。自分の宮殿をつくるとお使いいただけます'
