/**
 * 体験中に触れない場所。
 *
 * **隠さない。灰色にして、押せなくする。**
 *
 * 消してしまうと「この宮殿にはそれが無い」と読まれる。
 * 体験は「本物がどういうものか」を見てもらう場なので、
 * **あることは見せて、いまは使えないことだけを伝える**ほうがよい。
 *
 * 使えないのは、口座に紐づくもの（設定・支払い・退会）と、
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

/** 押せないことに添える一言。**なぜ使えないのかを言う** */
export const DEMO_LOCKED_HINT = '体験の宮殿では使えません。自分の宮殿をつくるとお使いいただけます'
